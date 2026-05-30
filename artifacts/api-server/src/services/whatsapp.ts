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
let _everConnected = false;  // true once connection reaches "open"
let _credsSaved = false;     // true once creds.update fires (pairing happened)

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
  _credsSaved = false;
  _everConnected = false;
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
    logger: logger.child({ module: "baileys", level: "silent" }) as any,
  });

  sock.ev.on("creds.update", () => {
    _credsSaved = true;
    void saveCreds();
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      _status = "qr_ready";
      qrBase64 = await QRCode.toDataURL(qr);
      logger.info("WhatsApp QR code ready");
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

      // QR expired without a scan — only true if the QR timed out AND
      // no credentials were saved (meaning the user never scanned).
      // After a successful scan, Baileys also closes with 408 as part of
      // the pairing handshake — in that case _credsSaved is true, so we
      // must NOT stop; we reconnect to complete the session establishment.
      const qrTimedOutNoScan = code === 408 && !_credsSaved && !_everConnected;

      _status = "disconnected";
      qrBase64 = null;
      logger.info({ code, credsSaved: _credsSaved, everConnected: _everConnected }, "WhatsApp connection closed");

      if (loggedOut) {
        logger.info("WhatsApp logged out — clearing session");
        _shouldReconnect = false;
        _clearSession();
        _resetState();
      } else if (qrTimedOutNoScan) {
        logger.info("WhatsApp QR expired without scan — waiting for manual reconnect");
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
  sock = null;
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
