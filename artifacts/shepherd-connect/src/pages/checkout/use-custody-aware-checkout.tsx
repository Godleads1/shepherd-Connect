import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, QrCode, ShieldCheck } from "lucide-react";
import type { CheckoutReleaseProof } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import QrCameraScanner from "@/components/QrCameraScanner";
import { useToast } from "@/hooks/use-toast";
import type { CheckoutOperationState, CheckoutSubmission } from "./checkout-operation";
import {
  checkoutErrorMessage,
  familyQrProof,
  getCheckoutAccess,
  isVerificationRejection,
  parseFamilyQr,
} from "./checkout-policy";

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
  canOverride: boolean;
  resolve: (state: CheckoutOperationState | null) => void;
  reject: (error: unknown) => void;
};

function childName(record: CheckoutRecord | null) {
  if (!record?.child) return "this child";
  const name = [record.child.firstName, record.child.lastName].filter(Boolean).join(" ").trim();
  return name || "this child";
}

/**
 * Every checkout needs proof that the collector is authorised. When the caller
 * already has proof (an approved helper code), it is sent directly; otherwise
 * staff are prompted to scan the parent's family QR. Only an Admin or Super
 * Admin may instead record an override reason. The server verifies both.
 */
export function useCustodyAwareCheckout({
  role,
  submit,
}: {
  role: string | null | undefined;
  submit: (attendanceId: number, input?: CheckoutSubmission) => Promise<CheckoutOperationState>;
}) {
  const { toast } = useToast();
  const [target, setTarget] = useState<CheckoutRecord | null>(null);
  const [canOverride, setCanOverride] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [reason, setReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingPrompt = useRef<PendingPrompt | null>(null);

  const resetForm = useCallback(() => {
    setQrValue("");
    setReason("");
    setShowOverride(false);
    setScanning(false);
    setValidationMessage("");
    setSubmitting(false);
  }, []);

  const settlePrompt = useCallback((state: CheckoutOperationState | null, error?: unknown) => {
    const pending = pendingPrompt.current;
    pendingPrompt.current = null;
    setTarget(null);
    resetForm();
    if (!pending) return;
    if (error) pending.reject(error);
    else pending.resolve(state);
  }, [resetForm]);

  useEffect(() => () => {
    pendingPrompt.current?.resolve(null);
    pendingPrompt.current = null;
  }, []);

  const requestCheckout = useCallback((record: CheckoutRecord, proof?: CheckoutReleaseProof) => {
    const access = getCheckoutAccess(role, record.custodyEpisodeId);
    if (access.kind === "blocked") {
      toast({
        variant: "destructive",
        title: "Checkout not permitted",
        description: access.message,
      });
      return Promise.resolve(null);
    }
    if (proof) return submit(record.id, { releaseProof: proof });
    if (pendingPrompt.current) return Promise.resolve(null);

    resetForm();
    setCanOverride(access.canOverride);
    setTarget(record);
    return new Promise<CheckoutOperationState | null>((resolve, reject) => {
      pendingPrompt.current = { record, canOverride: access.canOverride, resolve, reject };
    });
  }, [resetForm, role, submit, toast]);

  const cancelPrompt = useCallback(() => {
    if (!submitting) settlePrompt(null);
  }, [settlePrompt, submitting]);

  const confirm = useCallback(async () => {
    const pending = pendingPrompt.current;
    if (!pending || submitting) return;
    const typedQr = qrValue.trim();
    const trimmedReason = pending.canOverride ? reason.trim() : "";

    let input: CheckoutSubmission;
    if (typedQr && trimmedReason) {
      setValidationMessage("Use either the parent's QR or an override reason, not both.");
      return;
    }
    if (typedQr) {
      const familyCode = parseFamilyQr(typedQr);
      if (!familyCode) {
        setValidationMessage("That is not a family QR code. Scan the QR in the parent's app.");
        return;
      }
      input = { releaseProof: familyQrProof(familyCode) };
    } else if (trimmedReason) {
      input = { overrideReason: trimmedReason };
    } else {
      setValidationMessage(pending.canOverride
        ? "Scan the parent's family QR, or enter a reason to record an override."
        : "Scan the parent's family QR before releasing this child.");
      return;
    }

    setValidationMessage("");
    setSubmitting(true);
    try {
      const state = await submit(pending.record.id, input);
      if (state.phase === "rejected" && isVerificationRejection(state.error)) {
        // Verification failed and nothing was released. Keep the dialog open
        // so staff can scan again; the next attempt is a new operation.
        setSubmitting(false);
        setQrValue("");
        setValidationMessage(checkoutErrorMessage(state.error));
        return;
      }
      settlePrompt(state);
    } catch (error) {
      setSubmitting(false);
      setValidationMessage(checkoutErrorMessage(error));
    }
  }, [qrValue, reason, settlePrompt, submit, submitting]);

  const usingOverride = !qrValue.trim() && !!reason.trim();

  const verifyDialog = (
    <>
      <Dialog open={target !== null && !scanning} onOpenChange={open => { if (!open) cancelPrompt(); }}>
        <DialogContent className="max-w-md rounded-2xl" data-testid="verify-pickup-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <ShieldCheck className="h-5 w-5" />
              Verify pickup
            </DialogTitle>
            <DialogDescription>
              Scan the QR code in the parent's app before releasing {childName(target)}. The QR must belong to this child's family.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-2"
            onSubmit={event => { event.preventDefault(); void confirm(); }}
          >
            <label htmlFor="pickup-family-qr" className="text-sm font-semibold text-gray-800">
              Parent's family QR
            </label>
            <div className="flex gap-2">
              <Input
                id="pickup-family-qr"
                value={qrValue}
                onChange={event => {
                  setQrValue(event.target.value);
                  if (validationMessage) setValidationMessage("");
                }}
                placeholder="Scan or type FAM-XXXXXX"
                autoComplete="off"
                autoFocus
                disabled={submitting}
                className="font-mono uppercase"
                data-testid="pickup-family-qr"
              />
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 flex-shrink-0"
                onClick={() => setScanning(true)}
                disabled={submitting}
                data-testid="pickup-scan-camera"
              >
                <Camera className="h-4 w-4" /> Scan
              </Button>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <QrCode className="h-3.5 w-3.5" /> A handheld scanner can type straight into this box.
            </p>
          </form>

          {canOverride && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
              {!showOverride ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-amber-800 underline underline-offset-2"
                  onClick={() => setShowOverride(true)}
                  disabled={submitting}
                  data-testid="show-custody-override"
                >
                  Parent has no QR? Record an administrative override
                </button>
              ) : (
                <>
                  <label htmlFor="custody-override-reason" className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Reason for override
                  </label>
                  <Textarea
                    id="custody-override-reason"
                    value={reason}
                    onChange={event => {
                      setReason(event.target.value);
                      if (validationMessage) setValidationMessage("");
                    }}
                    maxLength={500}
                    rows={3}
                    disabled={submitting}
                    placeholder="For example: Duty manager verified the parent's identity at the pickup desk."
                    data-testid="custody-override-reason"
                  />
                  <p className="text-xs text-amber-800">
                    Leave the QR box empty to use an override. The reason is recorded in the audit trail.
                  </p>
                </>
              )}
            </div>
          )}

          <p
            id="verify-pickup-error"
            className="text-sm text-red-600 min-h-[1.25rem]"
            role={validationMessage ? "alert" : undefined}
            data-testid="verify-pickup-error"
          >
            {validationMessage}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelPrompt} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirm()}
              disabled={submitting || (!qrValue.trim() && !reason.trim())}
              className={usingOverride ? "bg-amber-700 hover:bg-amber-800 text-white" : undefined}
              data-testid="confirm-verified-checkout"
            >
              {submitting
                ? "Checking…"
                : usingOverride
                  ? "Confirm override & check out"
                  : "Verify & check out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {target !== null && scanning && (
        <QrCameraScanner
          hint="Point the camera at the QR code in the parent's app"
          onScan={code => {
            setQrValue(code.trim());
            setValidationMessage("");
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </>
  );

  return {
    requestCheckout,
    verifyDialog,
    promptOpen: target !== null,
  };
}
