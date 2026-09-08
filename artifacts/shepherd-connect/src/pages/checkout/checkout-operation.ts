import type { CheckoutResult } from "@workspace/api-client-react";

export type CheckoutPhase =
  | "idle"
  | "submitting"
  | "applied"
  | "already_applied"
  | "reconciling"
  | "rejected"
  | "unknown";

export type PendingCheckoutOperation = {
  operationId: string;
  attendanceId: number;
  createdAt: number;
  requiresOverrideReason?: boolean;
};

export type CheckoutOperationState = {
  phase: CheckoutPhase;
  pending: PendingCheckoutOperation | null;
  result?: CheckoutResult;
  error?: unknown;
};

export type CheckoutOperationTransport = {
  submit: (
    attendanceId: number,
    operationId: string,
    input?: CheckoutSubmission,
  ) => Promise<CheckoutResult>;
  reconcile: (attendanceId: number, operationId: string) => Promise<CheckoutResult>;
};

export type CheckoutSubmission = {
  overrideReason?: string;
};

const storageKey = (userId: number | string) => `shepherd.checkout.pending.${userId}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readPendingCheckout(userId: number | string): PendingCheckoutOperation | null {
  try {
    const value = sessionStorage.getItem(storageKey(userId));
    if (!value) return null;
    const pending = JSON.parse(value);
    if (!(typeof pending?.operationId === "string" &&
      UUID_PATTERN.test(pending.operationId) &&
      Number.isFinite(pending?.attendanceId) &&
      Number.isFinite(pending?.createdAt) &&
      (pending.requiresOverrideReason === undefined || typeof pending.requiresOverrideReason === "boolean"))) {
      return null;
    }
    return {
      operationId: pending.operationId,
      attendanceId: pending.attendanceId,
      createdAt: pending.createdAt,
      ...(pending.requiresOverrideReason === true ? { requiresOverrideReason: true } : {}),
    };
  } catch {
    return null;
  }
}

export function writePendingCheckout(userId: number | string, pending: PendingCheckoutOperation) {
  sessionStorage.setItem(storageKey(userId), JSON.stringify(pending));
}

export function clearPendingCheckout(userId: number | string) {
  sessionStorage.removeItem(storageKey(userId));
}

function statusOf(error: unknown): number | undefined {
  return typeof (error as any)?.status === "number" ? (error as any).status : undefined;
}

/** Only non-timeout HTTP client errors prove that this operation was rejected. */
export function isDefinitiveCheckoutRejection(error: unknown) {
  const status = statusOf(error);
  return status !== undefined && status >= 400 && status < 500 && status !== 408;
}

function isAlreadyApplied(result: CheckoutResult) {
  return result?.alreadyApplied || result?.outcome === "already_applied";
}

/**
 * Deliberately framework-free operation state machine. Persisted data is
 * restricted to the operation identity and is safe to restore after a reload.
 */
export class CheckoutOperation {
  state: CheckoutOperationState;

  constructor(
    private readonly userId: number | string,
    private readonly transport: CheckoutOperationTransport,
    private readonly newOperationId: () => string = () => crypto.randomUUID(),
    private readonly onChange: (state: CheckoutOperationState) => void = () => {},
  ) {
    this.state = { phase: "idle", pending: readPendingCheckout(userId) };
    this.emit();
  }

  private emit() {
    this.onChange(this.state);
  }

  private set(state: CheckoutOperationState) {
    this.state = state;
    this.emit();
  }

  private complete(phase: "applied" | "already_applied", result: CheckoutResult) {
    clearPendingCheckout(this.userId);
    this.set({ phase, pending: null, result });
  }

  private rejected(error: unknown) {
    clearPendingCheckout(this.userId);
    this.set({ phase: "rejected", pending: null, error });
  }

  private unknown(pending: PendingCheckoutOperation, error: unknown) {
    this.set({ phase: "unknown", pending, error });
  }

  private pendingFor(attendanceId: number, requiresOverrideReason: boolean) {
    const current = this.state.pending;
    if (current && current.attendanceId === attendanceId) return current;
    const pending = {
      attendanceId,
      operationId: this.newOperationId(),
      createdAt: Date.now(),
      ...(requiresOverrideReason ? { requiresOverrideReason: true } : {}),
    };
    writePendingCheckout(this.userId, pending);
    return pending;
  }

  async submit(attendanceId: number, input: CheckoutSubmission = {}): Promise<CheckoutOperationState> {
    // One persisted operation is deliberately locked until it is resolved.
    // Never overwrite an uncertain checkout with a different child's request.
    if (this.state.pending && this.state.pending.attendanceId !== attendanceId) {
      return this.state;
    }
    const overrideReason = input.overrideReason?.trim();
    const requiresOverrideReason = input.overrideReason !== undefined;
    const pending = this.pendingFor(attendanceId, requiresOverrideReason);
    if (pending.requiresOverrideReason && !overrideReason) {
      throw new Error("Enter a reason to retry this administrative custody override.");
    }
    if (!pending.requiresOverrideReason && requiresOverrideReason) {
      throw new Error("Resolve the current checkout operation before changing its checkout mode.");
    }
    this.set({ phase: "submitting", pending });
    try {
      const result = overrideReason
        ? await this.transport.submit(pending.attendanceId, pending.operationId, { overrideReason })
        : await this.transport.submit(pending.attendanceId, pending.operationId);
      this.complete(isAlreadyApplied(result) ? "already_applied" : "applied", result);
    } catch (error) {
      if (isDefinitiveCheckoutRejection(error)) this.rejected(error);
      else await this.reconcile(pending);
    }
    return this.state;
  }

  async reconcile(pending = this.state.pending): Promise<CheckoutOperationState> {
    if (!pending) return this.state;
    this.set({ phase: "reconciling", pending });
    try {
      const result = await this.transport.reconcile(pending.attendanceId, pending.operationId);
      this.complete(isAlreadyApplied(result) ? "already_applied" : "applied", result);
    } catch (error) {
      // A locked operation lookup confirms no commit; retain its UUID for retry.
      if (statusOf(error) === 404) this.set({ phase: "idle", pending, error });
      else this.unknown(pending, error);
    }
    return this.state;
  }

  recover() {
    return this.reconcile(this.state.pending);
  }
}