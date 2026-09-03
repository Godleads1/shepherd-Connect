import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(), finalize: vi.fn(), execute: vi.fn(), state: vi.fn(), send: vi.fn(),
  sms: vi.fn(), email: vi.fn(),
}));
vi.mock("@workspace/db", () => ({ db: { execute: mocks.execute } }));
vi.mock("../services/notificationOutbox", () => ({
  claimNotifications: mocks.claim, finalizeNotification: mocks.finalize,
}));
vi.mock("../services/whatsapp", () => ({
  getWhatsAppState: mocks.state, sendWhatsAppMessage: mocks.send,
}));
vi.mock("../services/sms", () => ({
  deliverOutboxSms: mocks.sms, deliverOutboxEmail: mocks.email,
}));
vi.mock("../lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { pollNotificationOutbox } from "../services/notificationDeliveryWorker";

const claimed = (overrides: Record<string, unknown> = {}) => ({
  id: "outbox-1", claimToken: "claim-1", attempts: 1, recipientUserId: 7,
  channel: "whatsapp", payloadJson: JSON.stringify({ notificationId: 9 }), ...overrides,
});
const recipient = { phone: "08012345678", email: null, communicationPrefs: JSON.stringify({ whatsapp: true }), title: "Title", message: "Body" };

describe("notification delivery worker (no provider traffic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.claim.mockResolvedValue([claimed()]);
    mocks.execute.mockResolvedValue({ rows: [recipient] });
    mocks.finalize.mockResolvedValue(true);
    mocks.state.mockReturnValue({ connected: true });
    mocks.send.mockResolvedValue(true);
    mocks.sms.mockResolvedValue({ outcome: "accepted", provider: "termii", providerMessageId: "termii-1" });
    mocks.email.mockResolvedValue({ outcome: "accepted", provider: "resend", providerMessageId: "resend-1" });
  });

  it("finalizes provider acceptance, never as delivered", async () => {
    await pollNotificationOutbox();
    expect(mocks.send).toHaveBeenCalledWith("08012345678", "*Title*\n\nBody");
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outcome: "accepted", provider: "baileys" }));
  });

  it("uses retryable only before submission when provider is unavailable", async () => {
    mocks.state.mockReturnValue({ connected: false });
    await pollNotificationOutbox();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outcome: "retryable", failureClassification: "provider_unavailable" }));
  });

  it("makes ambiguous provider responses terminal uncertain without fallback", async () => {
    mocks.send.mockResolvedValue(false);
    await pollNotificationOutbox();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outcome: "uncertain", failureClassification: "provider_ambiguous_response" }));
  });

  it("skips disabled preferences without contacting a provider", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ ...recipient, communicationPrefs: JSON.stringify({ whatsapp: false }) }] });
    await pollNotificationOutbox();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outcome: "skipped", failureClassification: "preference_disabled" }));
  });

  it("routes SMS to its adapter and persists its accepted provider receipt", async () => {
    mocks.claim.mockResolvedValue([claimed({ channel: "sms" })]);
    mocks.execute.mockResolvedValue({ rows: [{ ...recipient, communicationPrefs: JSON.stringify({ sms: true }) }] });
    await pollNotificationOutbox();
    expect(mocks.sms).toHaveBeenCalledWith("08012345678", "*Title*\n\nBody", expect.anything());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      outcome: "accepted", provider: "termii", providerMessageId: "termii-1", providerAcceptedAt: expect.any(Date),
    }));
  });

  it("preserves required SMS delivery when communication preferences are absent", async () => {
    mocks.claim.mockResolvedValue([claimed({ channel: "sms" })]);
    mocks.execute.mockResolvedValue({ rows: [{ ...recipient, communicationPrefs: null }] });
    await pollNotificationOutbox();
    expect(mocks.sms).toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outcome: "accepted" }));
  });

  it("routes email to its adapter without sending WhatsApp traffic", async () => {
    mocks.claim.mockResolvedValue([claimed({ channel: "email" })]);
    mocks.execute.mockResolvedValue({ rows: [{ ...recipient, email: "parent@example.test", communicationPrefs: JSON.stringify({ email: true }) }] });
    await pollNotificationOutbox();
    expect(mocks.email).toHaveBeenCalledWith("parent@example.test", "Title", expect.any(String), expect.anything());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      outcome: "accepted", provider: "resend", providerMessageId: "resend-1",
    }));
  });

  it("persists provider retryability without contacting a different provider", async () => {
    mocks.claim.mockResolvedValue([claimed({ channel: "sms" })]);
    mocks.execute.mockResolvedValue({ rows: [{ ...recipient, communicationPrefs: JSON.stringify({ sms: true }) }] });
    mocks.sms.mockResolvedValue({ outcome: "retryable", provider: "termii", failureClassification: "provider_rate_limited" });
    await pollNotificationOutbox();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      outcome: "retryable", failureClassification: "provider_rate_limited", provider: "termii",
    }));
  });

  it("does not overlap polls and can poll again after a completed/restarted pass", async () => {
    let release!: () => void;
    mocks.claim.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve([claimed()]); }));
    const first = pollNotificationOutbox();
    await Promise.resolve();
    await pollNotificationOutbox();
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    release();
    await first;
    mocks.claim.mockResolvedValue([]);
    await pollNotificationOutbox();
    expect(mocks.claim).toHaveBeenCalledTimes(2);
  });
});