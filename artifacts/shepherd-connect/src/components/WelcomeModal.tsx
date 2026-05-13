import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Users, ShieldCheck, ChevronRight, ChevronLeft, X } from "lucide-react";

const STORAGE_KEY = "shepherd-welcome-done";

const STEPS = [
  {
    icon: "🙏",
    title: "Welcome to Shepherd Connect",
    subtitle: "Safe. Known. Celebrated.",
    body: "Shepherd Connect helps you register your children, track their attendance, and stay in the loop every Sunday. Let us show you how to get started.",
    color: "#1e3a8a",
    bg: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)",
  },
  {
    icon: "👶",
    title: "Register Your Children",
    subtitle: "Step 1 of getting started",
    body: "Tap \"Add a Child\" on this page to add each of your children. Include their date of birth, gender, allergies, and a photo. The system will automatically suggest the right class for their age.",
    color: "#16a34a",
    bg: "linear-gradient(135deg, #14532d 0%, #16a34a 100%)",
  },
  {
    icon: "🔐",
    title: "Add a Pickup Delegate",
    subtitle: "Optional but recommended",
    body: "If someone else sometimes collects your children — a grandparent, aunt, or trusted friend — add them as a Pickup Delegate. They'll receive a secure 6-digit code for safe collection.",
    color: "#7c3aed",
    bg: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
  },
  {
    icon: "📱",
    title: "Your Family QR Code",
    subtitle: "Check-in made easy",
    body: "Every family gets a unique QR code. At the check-in kiosk on Sunday, simply show it to the attendant and all your children are checked in at once — no queues, no delays.",
    color: "#f59e0b",
    bg: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
  },
];

interface WelcomeModalProps {
  onClose: () => void;
  onAddChild: () => void;
}

export default function WelcomeModal({ onClose, onAddChild }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose();
  };

  const next = () => {
    if (isLast) { dismiss(); }
    else setStep(s => s + 1);
  };

  return (
    <Dialog open onOpenChange={dismiss}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0">
        <div className="relative text-white px-8 pt-10 pb-8 flex flex-col items-center text-center"
          style={{ background: current.bg, minHeight: 260 }}>
          <button onClick={dismiss}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="text-6xl mb-4 select-none" style={{ lineHeight: 1 }}>{current.icon}</div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">{current.subtitle}</p>
          <h2 className="text-2xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {current.title}
          </h2>

          <div className="flex gap-1.5 mt-5">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className="rounded-full transition-all duration-300"
                style={{ width: i === step ? 20 : 6, height: 6, background: i === step ? "white" : "rgba(255,255,255,0.35)" }}
              />
            ))}
          </div>
        </div>

        <div className="px-8 py-6 bg-white">
          <p className="text-gray-600 text-sm leading-relaxed text-center mb-6">{current.body}</p>

          <div className="flex flex-col gap-2">
            {step === 1 ? (
              <Button onClick={() => { dismiss(); onAddChild(); }}
                className="w-full py-5 text-base font-semibold rounded-xl"
                style={{ background: current.color }}>
                Add My First Child <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={next}
                className="w-full py-5 text-base font-semibold rounded-xl"
                style={{ background: current.color }}>
                {isLast ? "Get Started" : "Next"} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)}
                className="w-full text-gray-400 hover:text-gray-600 text-sm">
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            )}
          </div>

          <p className="text-center text-[11px] text-gray-300 mt-4">
            {step + 1} of {STEPS.length} · You can revisit this from your profile
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowWelcome(role: string | undefined, hasChildren: boolean): boolean {
  if (role !== "parent") return false;
  if (localStorage.getItem(STORAGE_KEY) === "true") return false;
  return true;
}
