import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { CheckoutOperationState, CheckoutSubmission } from "./checkout-operation";
import { getCheckoutAccess } from "./checkout-policy";

export type CheckoutRecord = {
  id: number;
  custodyEpisodeId?: number | null;
  child?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type PendingPrompt = {
  record: CheckoutRecord;
  resolve: (state: CheckoutOperationState | null) => void;
  reject: (error: unknown) => void;
};

function childName(record: CheckoutRecord | null) {
  if (!record?.child) return "this child";
  const name = [record.child.firstName, record.child.lastName].filter(Boolean).join(" ").trim();
  return name || "this child";
}

export function useCustodyAwareCheckout({
  role,
  submit,
}: {
  role: string | null | undefined;
  submit: (attendanceId: number, input?: CheckoutSubmission) => Promise<CheckoutOperationState>;
}) {
  const { toast } = useToast();
  const [target, setTarget] = useState<CheckoutRecord | null>(null);
  const [reason, setReason] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingPrompt = useRef<PendingPrompt | null>(null);

  const settlePrompt = useCallback((state: CheckoutOperationState | null, error?: unknown) => {
    const pending = pendingPrompt.current;
    pendingPrompt.current = null;
    setTarget(null);
    setReason("");
    setValidationMessage("");
    setSubmitting(false);
    if (!pending) return;
    if (error) pending.reject(error);
    else pending.resolve(state);
  }, []);

  useEffect(() => () => {
    pendingPrompt.current?.resolve(null);
    pendingPrompt.current = null;
  }, []);

  const requestCheckout = useCallback((record: CheckoutRecord) => {
    const access = getCheckoutAccess(role, record.custodyEpisodeId);
    if (access.kind === "blocked") {
      toast({
        variant: "destructive",
        title: "Checkout not permitted",
        description: access.message,
      });
      return Promise.resolve(null);
    }
    if (access.kind === "normal") return submit(record.id);
    if (pendingPrompt.current) return Promise.resolve(null);

    setTarget(record);
    setReason("");
    setValidationMessage("");
    return new Promise<CheckoutOperationState | null>((resolve, reject) => {
      pendingPrompt.current = { record, resolve, reject };
    });
  }, [role, submit, toast]);

  const cancelPrompt = useCallback(() => {
    if (!submitting) settlePrompt(null);
  }, [settlePrompt, submitting]);

  const confirmOverride = useCallback(async () => {
    const pending = pendingPrompt.current;
    const trimmedReason = reason.trim();
    if (!pending || submitting) return;
    if (!trimmedReason) {
      setValidationMessage("Enter a clear reason before completing this custody override.");
      return;
    }

    setValidationMessage("");
    setSubmitting(true);
    try {
      settlePrompt(await submit(pending.record.id, { overrideReason: trimmedReason }));
    } catch (error) {
      settlePrompt(null, error);
    }
  }, [reason, settlePrompt, submit, submitting]);

  const overrideDialog = (
    <Dialog open={target !== null} onOpenChange={open => { if (!open) cancelPrompt(); }}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="custody-override-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800">
            <ShieldCheck className="h-5 w-5" />
            Administrative custody override
          </DialogTitle>
          <DialogDescription>
            {childName(target)} is in Support custody. This action releases every active attendance record in the custody episode and is recorded in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="custody-override-reason" className="text-sm font-semibold text-gray-800">
            Reason for override
          </label>
          <Textarea
            id="custody-override-reason"
            value={reason}
            onChange={event => {
              setReason(event.target.value);
              if (validationMessage) setValidationMessage("");
            }}
            maxLength={500}
            rows={4}
            disabled={submitting}
            placeholder="For example: Duty manager verified the parent’s identity at the pickup desk."
            aria-invalid={validationMessage ? "true" : "false"}
            aria-describedby={validationMessage ? "custody-override-error" : undefined}
            data-testid="custody-override-reason"
          />
          <div className="flex items-start justify-between gap-3">
            <p id="custody-override-error" className="text-xs text-red-600" role={validationMessage ? "alert" : undefined}>
              {validationMessage}
            </p>
            <span className="text-xs text-gray-400 whitespace-nowrap">{reason.length}/500</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          Use this only when Support cannot complete the normal custodian release.
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={cancelPrompt} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void confirmOverride()}
            disabled={submitting || !reason.trim()}
            className="bg-amber-700 hover:bg-amber-800 text-white"
            data-testid="confirm-custody-override"
          >
            {submitting ? "Recording override…" : "Confirm override & check out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    requestCheckout,
    overrideDialog,
    promptOpen: target !== null,
  };
}