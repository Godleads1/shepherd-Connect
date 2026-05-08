import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Trash2, ScanFace, CheckCircle2 } from "lucide-react";
import FaceCapture from "@/components/FaceCapture";
import { apiPut, apiDelete } from "@/lib/api-call";

interface FaceEnrollmentProps {
  childId: number;
  childName: string;
  isEnrolled: boolean;
  onUpdate: () => void;
}

export default function FaceEnrollment({ childId, childName, isEnrolled, onUpdate }: FaceEnrollmentProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"consent" | "capture" | "done">("consent");
  const [saving, setSaving] = useState(false);
  const [pendingDescriptor, setPendingDescriptor] = useState<number[] | null>(null);
  const { toast } = useToast();

  const handleDescriptor = (descriptor: number[]) => {
    setPendingDescriptor(descriptor);
    setStep("capture");
  };

  const handleSave = async () => {
    if (!pendingDescriptor) return;
    setSaving(true);
    try {
      await apiPut(`/children/${childId}/face-descriptor`, { descriptorJson: JSON.stringify(pendingDescriptor), consentGiven: true });
      toast({ title: "Face Enrolled", description: `${childName}'s face has been registered for check-in.` });
      setStep("done");
      onUpdate();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await apiDelete(`/children/${childId}/face-descriptor`);
      toast({ title: "Biometric data deleted", description: "Face data has been permanently removed." });
      setOpen(false);
      onUpdate();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("consent");
    setPendingDescriptor(null);
  };

  return (
    <>
      <div
        className="rounded-2xl border p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-sm"
        style={{ borderColor: isEnrolled ? "#16a34a" : "#e5e7eb", background: isEnrolled ? "#f0fdf4" : "#fafafa" }}
        onClick={() => setOpen(true)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: isEnrolled ? "#dcfce7" : "#eff6ff" }}>
          <ScanFace className="w-5 h-5" style={{ color: isEnrolled ? "#16a34a" : "#1e3a8a" }} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">Face Recognition</p>
          <p className="text-xs mt-0.5" style={{ color: isEnrolled ? "#16a34a" : "#6b7280" }}>
            {isEnrolled ? "✓ Enrolled — tap to update or remove" : "Optional · Tap to enrol"}
          </p>
        </div>
        {isEnrolled ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
        ) : (
          <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-1 rounded-lg">Set Up</span>
        )}
      </div>

      <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-[#1e3a8a]" />
              Face Recognition — {childName}
            </DialogTitle>
          </DialogHeader>

          {step === "consent" && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Privacy & Consent</p>
                <ul className="space-y-1 text-xs text-blue-700 list-disc ml-4">
                  <li>Face data is stored as a mathematical vector — no photos are saved</li>
                  <li>Data is stored separately from personal information</li>
                  <li>You can delete it at any time</li>
                  <li>Never shared with third parties</li>
                  <li>Used only for check-in identification at this church</li>
                </ul>
              </div>
              {isEnrolled ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center">{childName} is already enrolled. What would you like to do?</p>
                  <Button onClick={() => setStep("capture")} className="w-full" style={{ background: "#1e3a8a" }}>
                    Re-capture Face
                  </Button>
                  <Button variant="outline" onClick={handleDelete} disabled={saving}
                    className="w-full text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Biometric Data
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center">
                    By continuing, you consent to biometric data collection for {childName}.
                  </p>
                  <Button onClick={() => setStep("capture")} className="w-full" style={{ background: "#1e3a8a" }}>
                    I Consent — Continue
                  </Button>
                  <Button variant="ghost" onClick={handleClose} className="w-full text-gray-500">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === "capture" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                Position {childName}'s face clearly in the oval guide, then tap Capture.
              </p>
              <FaceCapture
                mode="enroll"
                label={`Capture ${childName.split(" ")[0]}'s Face`}
                onDescriptor={handleDescriptor}
              />
              {pendingDescriptor && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full"
                  style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
                >
                  {saving ? "Saving..." : "Save & Enroll"}
                </Button>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <div>
                <p className="font-bold text-gray-900">Enrollment Complete!</p>
                <p className="text-sm text-gray-500 mt-1">{childName} can now be identified at check-in via face recognition.</p>
              </div>
              <Button onClick={handleClose} style={{ background: "#1e3a8a" }} className="w-full">Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
