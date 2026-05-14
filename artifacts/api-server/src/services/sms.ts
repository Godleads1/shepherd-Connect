import type { Logger } from "pino";

const API_KEY  = process.env.TERMII_API_KEY;
const BASE_URL = "https://v3.api.termii.com";
const SENDER   = "N-Alert";

function isConfigured() { return Boolean(API_KEY); }

function normalisePhone(phone: string): string {
  const s = phone.replace(/[\s\-().+]/g, "");
  if (s.startsWith("0"))   return "234" + s.slice(1);
  if (s.startsWith("234")) return s;
  return s;
}

async function send(to: string, sms: string, channel: "generic" | "dnd" | "whatsapp" = "generic", logger?: Logger): Promise<void> {
  if (!isConfigured()) { logger?.warn("Termii not configured — SMS skipped"); return; }
  const normalised = normalisePhone(to);
  try {
    const res = await fetch(`${BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: normalised, from: SENDER, sms, type: "plain", channel, api_key: API_KEY }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) logger?.error({ to: normalised, status: res.status, data }, "Termii send failed");
    else logger?.info({ to: normalised }, "Message sent via Termii");
  } catch (err) {
    logger?.error({ to: normalised, err: String(err) }, "Termii request error");
  }
}

async function sendToPhones(phones: (string | null | undefined)[], msg: string, logger?: Logger) {
  const valid = phones.filter((p): p is string => Boolean(p && p.trim().length >= 7));
  await Promise.all(valid.map(p => send(p, msg, "generic", logger)));
}

// ── OTP ─────────────────────────────────────────────────────────────────────

export async function sendOtp(phone: string, channel: "sms" | "whatsapp", logger?: Logger): Promise<{ pinId: string } | null> {
  if (!isConfigured()) { logger?.warn("Termii not configured — OTP skipped"); return null; }
  const normalised = normalisePhone(phone);
  const termiiChannel = channel === "whatsapp" ? "whatsapp" : "generic";
  try {
    const res = await fetch(`${BASE_URL}/api/sms/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: API_KEY,
        message_type: "NUMERIC",
        to: normalised,
        from: SENDER,
        channel: termiiChannel,
        pin_attempts: 3,
        pin_time_to_live: 10,
        pin_length: 6,
        pin_placeholder: "< 1234 >",
        message_text: "Your Shepherd Connect code is < 1234 >. Valid for 10 mins. — RCCG City of David",
        pin_type: "NUMERIC",
      }),
    });
    const data = await res.json() as { pinId?: string; pin_id?: string; [key: string]: unknown };
    if (!res.ok) { logger?.error({ to: normalised, status: res.status, data }, "Termii OTP send failed"); return null; }
    const pinId = (data.pinId ?? data.pin_id ?? "") as string;
    logger?.info({ to: normalised, pinId }, "OTP sent");
    return { pinId };
  } catch (err) {
    logger?.error({ to: normalised, err: String(err) }, "Termii OTP request error");
    return null;
  }
}

export async function verifyOtp(pinId: string, pin: string, logger?: Logger): Promise<boolean> {
  if (!isConfigured()) { logger?.warn("Termii not configured — OTP verify skipped"); return false; }
  try {
    const res = await fetch(`${BASE_URL}/api/sms/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: API_KEY, pin_id: pinId, pin }),
    });
    const data = await res.json() as { verified?: boolean; [key: string]: unknown };
    if (!res.ok) { logger?.error({ pinId, status: res.status, data }, "Termii OTP verify failed"); return false; }
    return data.verified === true;
  } catch (err) {
    logger?.error({ pinId, err: String(err) }, "Termii OTP verify error");
    return false;
  }
}

// ── Notification helpers (same exports as before) ────────────────────────────

export async function smsWelcome(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, welcome to Shepherd Connect! Your account is ready. — RCCG City of David`, "generic", logger);
}

export async function smsPendingApproval(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, your Shepherd Connect account is pending admin approval. You'll be notified by SMS once approved. — RCCG City of David`, "generic", logger);
}

export async function smsAccountApproved(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, your Shepherd Connect account has been approved! Log in at https://shepherd-connect--egbuchulamchine.replit.app — RCCG City of David`, "generic", logger);
}

export async function smsAccountRejected(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, your Shepherd Connect account application was not approved. Contact the church admin for more info. — RCCG City of David`, "generic", logger);
}

export async function smsPasswordResetCode(phone: string | null | undefined, code: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Your Shepherd Connect password reset code is: ${code}. Expires in 15 minutes. Do not share. — RCCG City of David`, "generic", logger);
}

export async function smsChildCheckedIn(phones: (string | null | undefined)[], childName: string, className: string, serviceSlot: string, logger?: Logger) {
  const slot = serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";
  await sendToPhones(phones, `✅ ${childName} has been checked in to ${className} for the ${slot} service. See you at pickup! — Shepherd Connect`, logger);
}

export async function smsChildCheckedOut(phones: (string | null | undefined)[], childName: string, logger?: Logger) {
  await sendToPhones(phones, `🎉 ${childName} has been picked up and checked out. Thank you! — Shepherd Connect, RCCG City of David`, logger);
}

export async function smsPreDismissal(phones: (string | null | undefined)[], childName: string, logger?: Logger) {
  await sendToPhones(phones, `📢 Service ending soon. ${childName} is ready for pickup at the children's church exit. — Shepherd Connect`, logger);
}
