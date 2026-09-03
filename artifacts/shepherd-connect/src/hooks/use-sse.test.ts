import { describe, expect, it, vi } from "vitest";
import { mintSseConnection } from "./use-sse";

describe("SSE connection ticketing", () => {
  it("mints before every token-free EventSource construction", async () => {
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      order.push(`mint:${url}:${(init?.headers as Record<string, string>).Authorization}`);
      return { ok: true } as Response;
    });
    const EventSourceImpl = vi.fn(function (this: EventSource, url: string) {
      order.push(`stream:${url}`);
      return {} as EventSource;
    }) as unknown as new (url: string) => EventSource;

    await mintSseConnection("first-token", { fetchImpl, EventSourceImpl });
    // A reconnect runs the same mint-before-connect operation with a fresh ticket.
    await mintSseConnection("second-token", { fetchImpl, EventSourceImpl });

    expect(order).toEqual([
      "mint:/api/events/ticket:Bearer first-token", "stream:/api/events",
      "mint:/api/events/ticket:Bearer second-token", "stream:/api/events",
    ]);
    expect(order.join(" ")).not.toContain("/api/events?token");
  });
});