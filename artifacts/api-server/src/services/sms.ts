import twilio from "twilio";
import type { Logger } from "pino";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

function getClient() {
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

function isConfigured(): boolean {
  return Boolean(accountSid && authToken && fromNumber);
}

async function sendSms(to: string, body: string, logger?: Logger): Promise<void> {
  if (!isConfigured()) {
    logger?.warn("Twilio not configured — SMS skipped");
    return;
  }
  const client = getClient();
  if (!client) return;

  const normalised = to.startsWith("+") ? to : `+${to.replace(/^0/, "234")}`;

  try {
    await client.messages.create({ from: fromNumber!, to: normalised, body });
    logger?.info({ to: normalised }, "SMS sent");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger?.error({ to: normalised, err: msg }, "SMS send failed");
  }
}

async function sendToPhones(phones: (string | null | undefined)[], body: string, logger?: Logger): Promise<void> {
  const valid = phones.filter((p): p is string => Boolean(p && p.trim().length >= 7));
  await Promise.all(valid.map(p => sendSms(p, body, logger)));
}

export async function smsWelcome(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await sendSms(phone,
    `Hi ${firstName}, welcome to Shepherd Connect! Your account is ready. Open the app to see your family details. — RCCG City of David`,
    logger,
  );
}

export async function smsPendingApproval(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await sendSms(phone,
    `Hi ${firstName}, your Shepherd Connect account is pending admin approval. You'll receive an SMS once it's approved. — RCCG City of David`,
    logger,
  );
}

export async function smsAccountApproved(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await sendSms(phone,
    `Hi ${firstName}, great news! Your Shepherd Connect account has been approved. You can now log in at https://shepherd-connect--egbuchulamchine.replit.app — RCCG City of David`,
    logger,
  );
}

export async function smsAccountRejected(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await sendSms(phone,
    `Hi ${firstName}, unfortunately your Shepherd Connect account application was not approved. Please contact the church admin for more information. — RCCG City of David`,
    logger,
  );
}

export async function smsPasswordResetCode(phone: string | null | undefined, code: string, logger?: Logger) {
  if (!phone) return;
  await sendSms(phone,
    `Your Shepherd Connect password reset code is: ${code}. It expires in 15 minutes. Do not share this code. — RCCG City of David`,
    logger,
  );
}

export async function smsChildCheckedIn(
  parentPhones: (string | null | undefined)[],
  childName: string,
  className: string,
  serviceSlot: string,
  logger?: Logger,
) {
  const slot = serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";
  await sendToPhones(parentPhones,
    `✅ ${childName} has been checked in to ${className} for the ${slot} service. See you at pickup! — Shepherd Connect`,
    logger,
  );
}

export async function smsChildCheckedOut(
  parentPhones: (string | null | undefined)[],
  childName: string,
  logger?: Logger,
) {
  await sendToPhones(parentPhones,
    `🎉 ${childName} has been picked up and checked out. Thank you for joining us today! — Shepherd Connect, RCCG City of David`,
    logger,
  );
}

export async function smsPreDismissal(
  parentPhones: (string | null | undefined)[],
  childName: string,
  logger?: Logger,
) {
  await sendToPhones(parentPhones,
    `📢 Service is ending soon. ${childName} is ready for pickup at the children's church exit. Please come now. — Shepherd Connect`,
    logger,
  );
}
