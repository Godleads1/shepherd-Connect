import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
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

type Status = "disconnected" | "connecting" | "qr_ready" | "connected";

let sock: WASocket | null = null;
let _status: Status = "disconnected";
let qrBase64: string | null = null;
let _shouldReconnect = false;
let _everConnected = false;   // true once we reach "open" state

export function getWhatsAppState() {
  return { status: _status, qr: qrBase64, connected: _status === "connected" };
}

/** Called on server boot — only resumes if a saved session already exists. */
export async function initWhatsApp(): Promise<void> {
  const hasSession =
    fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0;
  if (!hasSession) return; // no saved creds — admin must click Connect manually
  _shouldReconnect = true;
  await _connect();
}

/** Called by the admin clicking "Connect" in Settings. */
export async function connectWhatsApp(): Promise<void> {
  if (_status !== "disconnected") return; // already running
  _shouldReconnect = true;
  await _connect();
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
    // Silence Baileys' own verbose logging — we log what we need ourselves
    logger: logger.child({ module: "baileys", level: "silent" }) as any,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      _status = "qr_ready";
      qrBase64 = await QRCode.toDataURL(qr);
    }

    if (connection === "open") {
      _status = "connected";
      qrBase64 = null;
      _everConnected = true;
      logger.info("WhatsApp connected");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      // QR expired (408) and we never actually connected in this session →
      // stop looping; admin must manually click Connect again.
      const qrExpiredWithNoSession = code === 408 && !_everConnected;

      _status = "disconnected";
      qrBase64 = null;

      if (loggedOut) {
        logger.info({ code }, "WhatsApp logged out — clearing session");
        _shouldReconnect = false;
        _clearSession();
      } else if (qrExpiredWithNoSession) {
        logger.info("WhatsApp QR expired — waiting for admin to reconnect");
        _shouldReconnect = false;
      } else if (_shouldReconnect) {
        logger.info({ code }, "WhatsApp disconnected — reconnecting in 5 s");
        setTimeout(_connect, 5000);
      }

      if (!_shouldReconnect) {
        _everConnected = false;
        sock = null;
      }
    }
  });
}

export async function sendWhatsAppMessage(
  phone: string,
  text: string,
): Promise<boolean> {
  if (!sock || _status !== "connected") return false;
  const jid = _toJid(phone);
  try {
    await sock.sendMessage(jid, { text });
    logger.info({ to: jid }, "WhatsApp message sent");
    return true;
  } catch (err) {
    logger.error({ to: jid, err: String(err) }, "WhatsApp send error");
    return false;
  }
}

function _toJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("0") ? "234" + digits.slice(1) : digits;
  return number + "@s.whatsapp.net";
}

export async function disconnectWhatsApp(): Promise<void> {
  _shouldReconnect = false;
  _everConnected = false;
  if (sock) {
    try { await sock.logout(); } catch { /* ignore */ }
    sock = null;
  }
  _status = "disconnected";
  qrBase64 = null;
  _clearSession();
  logger.info("WhatsApp session cleared");
}

function _clearSession() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}
