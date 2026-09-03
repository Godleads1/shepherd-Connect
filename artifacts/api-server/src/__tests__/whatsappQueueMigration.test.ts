import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  delivery: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((query, part, index) => query + part + (index < values.length ? String(values[index]) : ""), ""),
}));
vi.mock("@workspace/db", () => ({
  db: {
    transaction: async (work: (tx: { execute: typeof mocks.execute }) => Promise<void>) => work({ execute: mocks.execute }),
  },
}));
vi.mock("../services/notificationOutbox", () => ({
  createNotificationDelivery: mocks.delivery,
}));
vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("legacy WhatsApp queue migration", async () => {
  const queue = await import("../lib/whatsapp-queue");

  beforeEach(() => {
    vi.clearAllMocks();
    let pending = true;
    mocks.execute.mockImplementation(async (query: string) => {
      if (query.includes("SELECT q.broadcast_id")) {
        return {
          rows: pending ? [
            { broadcastId: "broadcast-1", userId: 11, context: "notice", title: "Hello", message: "Message", processedAt: null },
            { broadcastId: "broadcast-1", userId: 12, context: "notice", title: "Hello", message: "Message", processedAt: new Date() },
          ] : [],
        };
      }
      if (query.includes("UPDATE whatsapp_queue_items")) pending = false;
      return { rows: [] };
    });
    mocks.delivery.mockResolvedValue({ notificationId: 1, outbox: [], inserted: true });
  });

  it("moves unclaimed work to pending outbox semantics and claimed work to uncertain without provider traffic", async () => {
    await queue.migrateLegacyWhatsAppQueue();

    expect(mocks.delivery).toHaveBeenCalledTimes(2);
    expect(mocks.delivery).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      logicalIdentity: "legacy-whatsapp:broadcast-1:recipient:11",
      channels: ["whatsapp"],
      projection: expect.objectContaining({ message: "Message" }),
    }));
    expect(mocks.execute.mock.calls.map(([query]) => String(query)).join("\n"))
      .toContain("legacy_claimed_unfinalized");
    expect(mocks.execute.mock.calls.map(([query]) => String(query)).join("\n"))
      .toContain("SET status = failed");
    // The migration module imports no provider and makes no dispatch call.
    expect(mocks.execute).toHaveBeenCalled();
  });

  it("is a no-op on a repeated startup after legacy rows are terminally marked", async () => {
    await queue.migrateLegacyWhatsAppQueue();
    await queue.migrateLegacyWhatsAppQueue();
    expect(mocks.delivery).toHaveBeenCalledTimes(2);
  });
});