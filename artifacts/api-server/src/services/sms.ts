import type { Logger } from "pino";

const API_KEY  = process.env.TERMII_API_KEY;
const BASE_URL = "https://v3.api.termii.com";
const SENDER   = "talert"; // Termii built-in default; swap for your registered sender ID
const APP_URL  = "https://shepherd-connect--egbuchulamchine.replit.app";

function isConfigured() { return Boolean(API_KEY); }

function normalisePhone(phone: string): string {
  const s = phone.replace(/[\s\-().+]/g, "");
  if (s.startsWith("0"))   return "234" + s.slice(1);
  if (s.startsWith("234")) return s;
  return s;
}

// ── HTML email template ───────────────────────────────────────────────────────

function emailHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,138,0.10)">
  <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#1a237e 100%);padding:28px 36px;text-align:center">
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);letter-spacing:2px;text-transform:uppercase">RCCG City of David</p>
    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#f59e0b;letter-spacing:-0.5px">Shepherd Connect</h1>
  </td></tr>
  <tr><td style="padding:32px 36px">
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">${title}</h2>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">Shepherd Connect &bull; RCCG City of David<br>Safe. Known. Celebrated.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function p(text: string) { return `<p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.6">${text}</p>`; }
function strong(text: string) { return `<strong style="color:#1e3a8a">${text}</strong>`; }
function badge(text: string, color = "#1e3a8a") { return `<span style="display:inline-block;background:${color}18;color:${color};border:1px solid ${color}30;border-radius:20px;padding:3px 12px;font-size:13px;font-weight:600">${text}</span>`; }
function btn(text: string, href: string) { return `<a href="${href}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:24px;font-weight:700;font-size:14px;margin:8px 0">${text}</a>`; }
function infoBox(html: string) { return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin:16px 0">${html}</div>`; }

// ── Email send (Termii email channel) ─────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string, logger?: Logger): Promise<void> {
  if (!isConfigured()) { logger?.warn("Termii not configured — email skipped"); return; }
  if (!to || !to.includes("@")) { logger?.warn({ to }, "Invalid email address — skipped"); return; }
  try {
    const res = await fetch(`${BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: "Shepherd Connect",
        sms: html,
        type: "plain",
        channel: "email",
        api_key: API_KEY,
        subject,
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) logger?.error({ to, status: res.status, data }, "Termii email send failed");
    else logger?.info({ to }, "Email sent via Termii");
  } catch (err) {
    logger?.error({ to, err: String(err) }, "Termii email request error");
  }
}

async function sendToEmails(emails: (string | null | undefined)[], subject: string, html: string, logger?: Logger) {
  const valid = emails.filter((e): e is string => Boolean(e && e.includes("@")));
  await Promise.all(valid.map(e => sendEmail(e, subject, html, logger)));
}

// ── SMS send ─────────────────────────────────────────────────────────────────

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
    if (!res.ok) logger?.error({ to: normalised, status: res.status, data }, "Termii SMS send failed");
    else logger?.info({ to: normalised }, "SMS sent via Termii");
  } catch (err) {
    logger?.error({ to: normalised, err: String(err) }, "Termii SMS request error");
  }
}

async function sendToPhones(phones: (string | null | undefined)[], msg: string, logger?: Logger) {
  const valid = phones.filter((p): p is string => Boolean(p && p.trim().length >= 7));
  await Promise.all(valid.map(p => send(p, msg, "generic", logger)));
}

// ── OTP ──────────────────────────────────────────────────────────────────────

export async function sendOtp(phone: string, channel: "sms" | "whatsapp", logger?: Logger): Promise<{ pinId: string } | null> {
  if (!isConfigured()) { logger?.warn("Termii not configured — OTP skipped"); return null; }
  const normalised = normalisePhone(phone);
  const termiiChannel = "generic"; // WhatsApp requires separate Business API activation
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

// ── Email notifications ───────────────────────────────────────────────────────

export async function emailWelcome(email: string | null | undefined, firstName: string, logger?: Logger) {
  if (!email) return;
  const html = emailHtml("Welcome to Shepherd Connect! 🎉", `
    ${p(`Hi ${strong(firstName)}, welcome to the Shepherd Connect family!`)}
    ${p("Your account has been created and you're all set to log in. We're thrilled to have you as part of the RCCG City of David children's ministry.")}
    ${infoBox(`${p("Use the button below to sign in to your account:")}
    ${btn("Sign In to Shepherd Connect", APP_URL)}`)}
    ${p("If you have any questions, please reach out to the church admin.")}
    ${p("God bless you! 🙏")}
  `);
  await sendEmail(email, "Welcome to Shepherd Connect!", html, logger);
}

export async function emailPendingApproval(email: string | null | undefined, firstName: string, logger?: Logger) {
  if (!email) return;
  const html = emailHtml("Account Pending Approval", `
    ${p(`Hi ${strong(firstName)}, thank you for registering on Shepherd Connect.`)}
    ${p("Your account is currently <strong>pending approval</strong> from our admin team. You will receive an email (and SMS) as soon as your account is approved.")}
    ${infoBox(p("⏳ Approval is usually completed within 24 hours. Once approved, you'll be able to log in and access all features."))}
    ${p("If you have any questions, please contact the church office directly.")}
  `);
  await sendEmail(email, "Shepherd Connect — Account Pending Approval", html, logger);
}

export async function emailAccountApproved(email: string | null | undefined, firstName: string, logger?: Logger) {
  if (!email) return;
  const html = emailHtml("Your Account Has Been Approved ✅", `
    ${p(`Hi ${strong(firstName)}, great news!`)}
    ${p("Your Shepherd Connect account has been <strong style='color:#059669'>approved</strong> by our admin team. You can now log in and access the platform.")}
    ${infoBox(`${p("Click below to sign in:")}${btn("Sign In Now", APP_URL)}`)}
    ${p("We look forward to serving alongside you. God bless you! 🙏")}
  `);
  await sendEmail(email, "Shepherd Connect — Account Approved!", html, logger);
}

export async function emailAccountRejected(email: string | null | undefined, firstName: string, logger?: Logger) {
  if (!email) return;
  const html = emailHtml("Account Application Update", `
    ${p(`Hi ${strong(firstName)}, thank you for your interest in Shepherd Connect.`)}
    ${p("Unfortunately, your account application was <strong style='color:#b91c1c'>not approved</strong> at this time.")}
    ${p("Please contact the church admin directly for more information or to discuss your application.")}
  `);
  await sendEmail(email, "Shepherd Connect — Account Application Update", html, logger);
}

export async function emailPasswordResetCode(email: string | null | undefined, firstName: string, code: string, logger?: Logger) {
  if (!email) return;
  const html = emailHtml("Password Reset Code", `
    ${p(`Hi ${strong(firstName)}, we received a request to reset your Shepherd Connect password.`)}
    ${infoBox(`<p style="margin:0;font-size:13px;color:#64748b">Your reset code:</p>
    <p style="margin:8px 0 0;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e3a8a">${code}</p>
    <p style="margin:8px 0 0;font-size:12px;color:#94a3b8">Expires in 15 minutes. Do not share this code.</p>`)}
    ${p("If you didn't request a password reset, you can safely ignore this email — your account remains secure.")}
  `);
  await sendEmail(email, "Shepherd Connect — Password Reset Code", html, logger);
}

export async function emailChildCheckedIn(emails: (string | null | undefined)[], childName: string, className: string, serviceSlot: string, logger?: Logger) {
  const slot = serviceSlot === "7am" ? "7:00 AM" : "10:30 AM";
  const html = emailHtml("Child Checked In ✅", `
    ${p(`${strong(childName)} has been successfully checked in for today's ${slot} service.`)}
    ${infoBox(`
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Check-in Details</p>
      <p style="margin:0;font-size:15px;color:#0f172a"><strong>Child:</strong> ${childName}</p>
      <p style="margin:4px 0 0;font-size:15px;color:#0f172a"><strong>Class:</strong> ${className}</p>
      <p style="margin:4px 0 0;font-size:15px;color:#0f172a"><strong>Service:</strong> ${slot}</p>
    `)}
    ${p("You'll receive another notification when your child is checked out. See you at pickup! 🙏")}
  `);
  await sendToEmails(emails, `${childName} checked in — Shepherd Connect`, html, logger);
}

export async function emailChildCheckedOut(emails: (string | null | undefined)[], childName: string, logger?: Logger) {
  const html = emailHtml("Child Picked Up 🎉", `
    ${p(`${strong(childName)} has been checked out and picked up safely.`)}
    ${p("Thank you for attending RCCG City of David today. We look forward to seeing you next Sunday!")}
    ${infoBox(p("🙏 God bless you and your family."))}
  `);
  await sendToEmails(emails, `${childName} picked up — Shepherd Connect`, html, logger);
}

function levelLabel(val: string | null | undefined): string {
  if (!val) return "—";
  return val === "needs_encouragement" ? "Needs Encouragement" : val.charAt(0).toUpperCase() + val.slice(1);
}
function levelColor(val: string | null | undefined): string {
  if (!val) return "#64748b";
  return { excellent: "#059669", good: "#1e3a8a", fair: "#d97706", needs_encouragement: "#b91c1c" }[val] ?? "#374151";
}

export async function emailShepherdsReport(
  emails: (string | null | undefined)[],
  parentFirstName: string,
  childName: string,
  teacherName: string,
  participationLevel: string | null | undefined,
  scriptureEngagement: string | null | undefined,
  socialInteraction: string | null | undefined,
  milestoneNote: string | null | undefined,
  personalNoteToParent: string | null | undefined,
  serviceDate: string,
  logger?: Logger,
) {
  const row = (label: string, val: string | null | undefined) =>
    `<tr><td style="padding:7px 0;font-size:14px;color:#374151;width:45%">${label}</td><td style="padding:7px 0;font-size:14px;font-weight:700;color:${levelColor(val)}">${levelLabel(val)}</td></tr>`;

  const html = emailHtml(`Shepherd's Report — ${childName}`, `
    ${p(`Dear ${strong(parentFirstName)}, here is your child's Shepherd's Report for ${strong(serviceDate)}.`)}
    ${p(`This report was prepared by ${strong(teacherName)} after today's service.`)}
    ${infoBox(`
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Child Assessment</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row("Participation", participationLevel)}
        ${row("Scripture Engagement", scriptureEngagement)}
        ${row("Social Interaction", socialInteraction)}
      </table>
    `)}
    ${milestoneNote ? infoBox(`<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1px">🌟 Milestone</p><p style="margin:0;font-size:15px;color:#374151;line-height:1.6">${milestoneNote}</p>`) : ""}
    ${personalNoteToParent ? infoBox(`<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Teacher's Note</p><p style="margin:0;font-size:15px;color:#374151;line-height:1.6;font-style:italic">"${personalNoteToParent}"</p>`) : ""}
    ${btn("View Full Report", `${APP_URL}/appraisals`)}
    ${p("Thank you for trusting us with your child. God bless you! 🙏")}
  `);
  await sendToEmails(emails, `Shepherd's Report — ${childName} (${serviceDate})`, html, logger);
}

// ── SMS notifications ─────────────────────────────────────────────────────────

export async function smsWelcome(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, welcome to Shepherd Connect! Your account is ready. Log in at ${APP_URL} — RCCG City of David`, "generic", logger);
}

export async function smsPendingApproval(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, your Shepherd Connect account is pending admin approval. You'll be notified by SMS once approved. — RCCG City of David`, "generic", logger);
}

export async function smsAccountApproved(phone: string | null | undefined, firstName: string, logger?: Logger) {
  if (!phone) return;
  await send(phone, `Hi ${firstName}, your Shepherd Connect account has been approved! Log in at ${APP_URL} — RCCG City of David`, "generic", logger);
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

export async function smsRegistrationOtp(phone: string | null | undefined, otp: string, logger?: Logger) {
  if (!phone) return;
  await send(
    phone,
    `Your Shepherd Connect verification code is: ${otp}. Valid for 10 minutes. Do not share this code. — RCCG City of David`,
    "generic",
    logger,
  );
}

export async function smsDelegateOtp(phone: string | null | undefined, delegateName: string, childName: string, otpCode: string, logger?: Logger) {
  if (!phone) return;
  await send(
    phone,
    `Hi ${delegateName}, you have been authorised to pick up ${childName} from Shepherd Connect. Your pickup code is: ${otpCode}. Valid for 24 hours. — RCCG City of David`,
    "generic",
    logger,
  );
}
