import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutOperation } from "./checkout-operation";

const stableUuid = "3bfcaa23-0a21-43f6-9a31-94fdd947ab1b";
const result = { outcome: "applied", alreadyApplied: false };
const apiError = (status: number) => ({ status, message: `HTTP ${status}` });

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

function operation(submit: any, reconcile: any, uuid = vi.fn(() => stableUuid)) {
  return [new CheckoutOperation(7, { submit, reconcile }, uuid), uuid] as const;
}

describe("checkout operation reliability", () => {
  it("clears a definitive 4xx rejection without reconciling", async () => {
    const submit = vi.fn().mockRejectedValue(apiError(422));
    const reconcile = vi.fn();
    const [op] = operation(submit, reconcile);
    await op.submit(11);
    expect(op.state.phase).toBe("rejected");
    expect(op.state.pending).toBeNull();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it.each([
    ["network", new TypeError("network down")],
    ["parse", { name: "ResponseParseError", status: 200 }],
    ["server", apiError(503)],
    ["timeout", apiError(408)],
  ])("reconciles after a %s submission failure", async (_name, error) => {
    const submit = vi.fn().mockRejectedValue(error);
    const reconcile = vi.fn().mockResolvedValue(result);
    const [op] = operation(submit, reconcile);
    await op.submit(11);
    expect(op.state.phase).toBe("applied");
    expect(reconcile).toHaveBeenCalledWith(11, stableUuid);
  });

  it("leaves the identity actionable when reconciliation fails", async () => {
    const [op] = operation(vi.fn().mockRejectedValue(new TypeError("offline")), vi.fn().mockRejectedValue(new Error("offline")));
    await op.submit(11);
    expect(op.state.phase).toBe("unknown");
    expect(op.state.pending?.operationId).toBe(stableUuid);
  });

  it("retries with the same UUID, including after a reconciliation 404", async () => {
    const submit = vi.fn()
      .mockRejectedValueOnce(new TypeError("timeout"))
      .mockResolvedValueOnce(result);
    const reconcile = vi.fn().mockRejectedValue(apiError(404));
    const [op, uuid] = operation(submit, reconcile);
    await op.submit(11);
    expect(op.state.phase).toBe("idle");
    await op.submit(11);
    expect(submit.mock.calls).toEqual([[11, stableUuid], [11, stableUuid]]);
    expect(uuid).toHaveBeenCalledOnce();
  });

  it("recovers persisted pending work after reload", async () => {
    const first = operation(vi.fn().mockRejectedValue(new TypeError("offline")), vi.fn().mockRejectedValue(new Error("offline")))[0];
    await first.submit(21);
    const reconcile = vi.fn().mockResolvedValue(result);
    const [reloaded] = operation(vi.fn(), reconcile);
    await reloaded.recover();
    expect(reconcile).toHaveBeenCalledWith(21, stableUuid);
    expect(reloaded.state.phase).toBe("applied");
  });

  it("keeps recovered 404 work actionable with its original operation ID", async () => {
    const first = operation(
      vi.fn().mockRejectedValue(new TypeError("offline")),
      vi.fn().mockRejectedValue(new Error("offline")),
    )[0];
    await first.submit(21);
    const reconcile = vi.fn().mockRejectedValue(apiError(404));
    const [reloaded, uuid] = operation(vi.fn(), reconcile);
    await reloaded.recover();
    expect(reloaded.state.phase).toBe("idle");
    expect(reloaded.state.pending?.operationId).toBe(stableUuid);

    const submit = vi.fn().mockResolvedValue(result);
    const retry = new CheckoutOperation(7, { submit, reconcile }, uuid);
    await retry.submit(21);
    expect(submit).toHaveBeenCalledWith(21, stableUuid);
  });

  it("never reuses a pending operation ID for another attendance record", async () => {
    const submit = vi.fn().mockRejectedValue(new TypeError("offline"));
    const [op] = operation(submit, vi.fn().mockRejectedValue(new Error("offline")));
    await op.submit(21);
    await op.submit(22);
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(21, stableUuid);
    expect(op.state.pending).toMatchObject({ attendanceId: 21, operationId: stableUuid });
  });
});