import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckoutOperation,
  type CheckoutOperationState,
  type CheckoutOperationTransport,
} from "./checkout-operation";
import { refreshAfterCommittedCheckout } from "./checkout-flow";

type Options = {
  userId: number | string | undefined;
  transport: CheckoutOperationTransport;
  onCommitted: () => Promise<void>;
  onRefreshFailure?: () => void;
};

const isCommitted = (state: CheckoutOperationState) =>
  state.phase === "applied" || state.phase === "already_applied";

/**
 * Binds the persisted checkout state machine to React. A user-scoped pending
 * operation is reconciled whenever this binding is mounted, never replaced.
 */
export function useCheckoutOperation({
  userId,
  transport,
  onCommitted,
  onRefreshFailure,
}: Options) {
  const [state, setState] = useState<CheckoutOperationState>({ phase: "idle", pending: null });
  const operationRef = useRef<CheckoutOperation | null>(null);
  const onCommittedRef = useRef(onCommitted);
  const onRefreshFailureRef = useRef(onRefreshFailure);
  onCommittedRef.current = onCommitted;
  onRefreshFailureRef.current = onRefreshFailure;

  const afterCommitted = useCallback(async (next: CheckoutOperationState) => {
    if (!isCommitted(next)) return next;
    const refresh = await refreshAfterCommittedCheckout(onCommittedRef.current);
    if (refresh.status === "refresh_failed") {
      onRefreshFailureRef.current?.();
    }
    return next;
  }, []);

  useEffect(() => {
    if (userId === undefined || userId === null) {
      operationRef.current = null;
      setState({ phase: "idle", pending: null });
      return;
    }
    let active = true;
    const operation = new CheckoutOperation(userId, transport, undefined, next => {
      if (active) setState(next);
    });
    operationRef.current = operation;
    setState(operation.state);
    if (operation.state.pending) {
      void operation.recover().then(next => active ? afterCommitted(next) : next);
    }
    return () => {
      active = false;
      if (operationRef.current === operation) operationRef.current = null;
    };
  }, [userId, transport, afterCommitted]);

  const submit = useCallback(async (attendanceId: number) => {
    if (!operationRef.current) throw new Error("Checkout is not ready");
    return afterCommitted(await operationRef.current.submit(attendanceId));
  }, [afterCommitted]);

  const checkStatus = useCallback(async () => {
    if (!operationRef.current) return state;
    return afterCommitted(await operationRef.current.reconcile());
  }, [afterCommitted, state]);

  const retry = useCallback(async () => {
    const pending = operationRef.current?.state.pending;
    if (!pending) return operationRef.current?.state ?? state;
    return submit(pending.attendanceId);
  }, [state, submit]);

  return { state, submit, checkStatus, retry };
}

export function CheckoutRecoveryControls({
  state,
  onCheckStatus,
  onRetry,
}: {
  state: CheckoutOperationState;
  onCheckStatus: () => void;
  onRetry: () => void;
}) {
  if (!state.pending || (state.phase !== "unknown" && state.phase !== "idle")) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-center gap-3">
      <p className="text-sm font-medium text-amber-900">
        {state.phase === "unknown"
          ? "Checkout status is temporarily unknown"
          : "Checkout was not confirmed"}
      </p>
      <Button size="sm" variant="outline" onClick={onCheckStatus}>
        Check status
      </Button>
      <Button size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}