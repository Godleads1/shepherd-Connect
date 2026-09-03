import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";

const AUTH_DIR =
  process.env.WHATSAPP_AUTH_DIR ??
  path.resolve(process.cwd(), "../../.whatsapp-auth");

type Status = "disconnected" | "connecting" | "pairing_code_ready" | "qr_ready" | "connected";

let sock: WASocket | null = null;
let _status: Status = "disconnected";
let qrBase64: string | null = null;
let _pairingCode: string | null = null;
let _shouldReconnect = false;
let _everConnected = false;
let _credsSaved = false;
let _phoneNumber: string | null = null;  // set when using phone-pairing mode

export function getWhatsAppState() {
  return {
    status: _status,
    qr: qrBase64,
    pairingCode: _pairingCode,
    connected: _status === "connected",
  };
}

/** Called on server boot — only resumes if a saved session already exists. */
export async function initWhatsApp(): Promise<void> {
  const hasSession =
    fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0;
  if (!hasSession) return;
  _shouldReconnect = true;
  await _connect();
}

/** QR-code connection mode (original). */
export async function connectWhatsApp(): Promise<void> {
  if (_status !== "disconnected") return;
  _phoneNumber = null;
  _shouldReconnect = true;
  _credsSaved = false;
  _everConnected = false;
  await _connect();
}

/** Phone-number pairing mode — no QR scan needed. */
export async function connectWithPhone(rawPhone: string): Promise<void> {
  if (_status !== "disconnected") return;
  _phoneNumber = _normalizePhone(rawPhone);
  _shouldReconnect = true;
  _credsSaved = false;
  _everConnected = false;
  _pairingCode = null;
  await _connect();
}

function _normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "234" + digits.slice(1);
  if (digits.startsWith("+")) return digits.slice(1);
  return digits;
}

async function _connect(): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  _status = "connecting";
  qrBase64 = null;

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["Shepherd Connect", "Chrome", "1.0.0"],
    logger: {
      level: "silent",
      trace: () => {}, debug: () => {}, info: () => {},
      warn: (obj: unknown, msg?: string) => {
        // only surface genuine warnings (not routine sync chatter)
        if (msg && (msg.includes("url generation failed") || msg.includes("connection"))) {
          logger.warn({ module: "baileys", obj }, msg);
        }
      },
      error: (obj: unknown, msg?: string) => logger.error({ module: "baileys", obj }, msg ?? "baileys error"),
      fatal: () => {},
      child: () => ({ level: "silent", trace: ()=>{}, debug: ()=>{}, info: ()=>{}, warn: ()=>{}, error: ()=>{}, fatal: ()=>{}, child: ()=>({}) }),
    } as any,
  });

  sock.ev.on("creds.update", () => {
    _credsSaved = true;
    void saveCreds();
  });

  // Request pairing code once WS handshake is in progress (phone mode only).
  // We wait 2 s to let Baileys complete its initial handshake before calling
  // requestPairingCode — calling it too early causes a "not connected" error.
  if (_phoneNumber && !state.creds.registered) {
    const capturedPhone = _phoneNumber;
    const capturedSock = sock;
    setTimeout(async () => {
      if (!capturedSock || _credsSaved) return; // already paired or socket gone
      try {
        const code = await capturedSock.requestPairingCode(capturedPhone);
        _pairingCode = code;
        if (_status === "connecting") _status = "pairing_code_ready";
        logger.info({ code }, "WhatsApp pairing code ready");
      } catch (err) {
        logger.error({ err: String(err) }, "Failed to request WhatsApp pairing code");
      }
    }, 2000);
  }

  // ── Inbound message handler (bot) ──────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      // Ignore own messages, status updates, and group chats
      if (msg.key.fromMe) continue;
      if (!msg.key.remoteJid || msg.key.remoteJid === "status@broadcast") continue;
      if (msg.key.remoteJid.endsWith("@g.us")) continue;

      const fromJid = msg.key.remoteJid;
      const text =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        msg.message?.imageMessage?.caption ??
        "";

      const isImage = !!msg.message?.imageMessage;
      let imageBuffer: Buffer | null = null;

      if (isImage) {
        try {
          const downloaded = await downloadMediaMessage(msg, "buffer", {});
          imageBuffer = downloaded as Buffer;
        } catch (err) {
          logger.error({ from: fromJid, err: String(err) }, "Failed to download WhatsApp image");
        }
      }

      if (!text.trim() && !imageBuffer) continue;

      logger.info({ from: fromJid, text, isImage }, "WhatsApp inbound message");

      const capturedSock = sock;

      const reply = async (replyText: string) => {
        if (!capturedSock) return;
        try {
          await capturedSock.sendMessage(fromJid, { text: replyText });
        } catch (err) {
          logger.error({ to: fromJid, err: String(err) }, "Bot reply failed");
        }
      };

      const replyWithImage = async (buf: Buffer, caption: string) => {
        if (!capturedSock) return;
        try {
          await capturedSock.sendMessage(fromJid, { image: buf, caption });
        } catch (err) {
          logger.error({ to: fromJid, err: String(err) }, "Bot image reply failed");
        }
      };

      try {
        const { handleInboundMessage } = await import("./whatsappBot");
        await handleInboundMessage(fromJid, text, imageBuffer, reply, replyWithImage, msg.key.id ?? undefined);
      } catch (err) {
        logger.error({ from: fromJid, err: String(err) }, "WhatsApp bot error");
      }
    }
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr && !_phoneNumber) {
      _status = "qr_ready";
      qrBase64 = await QRCode.toDataURL(qr);
      logger.info("WhatsApp QR code ready");
    }

    if (connection === "open") {
      _status = "connected";
      qrBase64 = null;
      _pairingCode = null;
      _everConnected = true;
      logger.info("WhatsApp connected");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      // QR expired without scan: code 408, no creds ever saved, not phone-pairing mode
      const qrTimedOutNoScan =
        code === 408 && !_credsSaved && !_everConnected && !_phoneNumber;

      _status = "disconnected";
      qrBase64 = null;
      logger.info(
        { code, credsSaved: _credsSaved, everConnected: _everConnected },
        "WhatsApp connection closed",
      );

      if (loggedOut) {
        logger.info("WhatsApp logged out — clearing session");
        _shouldReconnect = false;
        _clearSession();
        _resetState();
      } else if (qrTimedOutNoScan) {
        logger.info("WhatsApp QR expired — waiting for manual reconnect");
        _shouldReconnect = false;
        _resetState();
      } else if (_shouldReconnect) {
        logger.info({ code }, "WhatsApp reconnecting in 5 s");
        setTimeout(_connect, 5000);
      }

      if (!_shouldReconnect) sock = null;
    }
  });
}

function _resetState() {
  _everConnected = false;
  _credsSaved = false;
  _pairingCode = null;
  _phoneNumber = null;
  sock = null;
}

export async function sendWhatsAppMessage(
  phone: string,
  text: string,
): Promise<boolean> {
  if (!sock || _status !== "connected") return false;
  const jid = _normalizePhone(phone) + "@s.whatsapp.net";
  try {
    await sock.sendMessage(jid, { text });
    logger.info({ to: jid }, "WhatsApp message sent");
    return true;
  } catch (err) {
    logger.error({ to: jid, err: String(err) }, "WhatsApp send error");
    return false;
  }
}

/** Send a text message to any JID directly (for proactive bot messages). */
export async function sendWhatsAppToJid(
  jid: string,
  text: string,
): Promise<boolean> {
  if (!sock || _status !== "connected") return false;
  try {
    await sock.sendMessage(jid, { text });
    logger.info({ to: jid }, "WhatsApp message sent");
    return true;
  } catch (err) {
    logger.error({ to: jid, err: String(err) }, "WhatsApp send error");
    return false;
  }
}

/** Send an image to any JID directly (for photo relay). */
export async function sendWhatsAppImageToJid(
  jid: string,
  imageBuffer: Buffer,
  caption: string,
): Promise<boolean> {
  if (!sock || _status !== "connected") return false;
  try {
    await sock.sendMessage(jid, { image: imageBuffer, caption });
    logger.info({ to: jid }, "WhatsApp image sent");
    return true;
  } catch (err) {
    logger.error({ to: jid, err: String(err) }, "WhatsApp image send error");
    return false;
  }
}

/**
 * Clean socket close WITHOUT clearing the session — called on server shutdown
 * so WhatsApp sees a normal disconnect rather than a TCP drop.
 */
export async function closeWhatsAppClean(): Promise<void> {
  _shouldReconnect = false;
  if (sock) {
    try { sock.end(undefined); } catch { /* ignore */ }
    sock = null;
  }
  _status = "disconnected";
}

export async function disconnectWhatsApp(): Promise<void> {
  _shouldReconnect = false;
  if (sock) {
    try { await sock.logout(); } catch { /* ignore */ }
    sock = null;
  }
  _status = "disconnected";
  qrBase64 = null;
  _clearSession();
  _resetState();
  logger.info("WhatsApp session cleared");
}

function _clearSession() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}
