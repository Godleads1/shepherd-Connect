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
let _initialized = false;

export function getWhatsAppState() {
  return { status: _status, qr: qrBase64, connected: _status === "connected" };
}

export async function initWhatsApp(): Promise<void> {
  if (_initialized && _status !== "disconnected") return;
  _initialized = true;
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
    logger: logger.child({ module: "baileys" }) as any,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      _status = "qr_ready";
      qrBase64 = await QRCode.toDataURL(qr);
      logger.info("WhatsApp QR code ready — scan to connect");
    }

    if (connection === "open") {
      _status = "connected";
      qrBase64 = null;
      logger.info("WhatsApp connected");
    }

    if (connection === "close") {
      _status = "disconnected";
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      logger.warn({ code }, "WhatsApp connection closed");
      if (_shouldReconnect && !loggedOut) {
        setTimeout(_connect, 5000);
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
  _initialized = false;
  if (sock) {
    try { await sock.logout(); } catch { /* ignore */ }
    sock = null;
  }
  _status = "disconnected";
  qrBase64 = null;
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
  logger.info("WhatsApp session cleared");
}
