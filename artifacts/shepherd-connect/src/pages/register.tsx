import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useCreateFamily, useCreateChild, useListClasses } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import {
  Plus, Trash2, ChevronRight, Check, User, Mail, Phone, Lock,
  Home, ShieldAlert, Loader2, MapPin, Bus, Eye, EyeOff,
  MessageCircle, ShieldCheck, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader } from "@/components/PhotoUploader";

const LOGO_NAVY  = "#1a237e";
const LOGO_GREEN = "#1b5e20";

// ── Schemas ──────────────────────────────────────────────────────────────────
const PHONE_RE = /^\d{11}$/;
const phoneMsg = "Must be exactly 11 digits";

const step1Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName:  z.string().min(1, "Required"),
  email:     z.string().email("Invalid email address"),
  phone:     z.string().regex(PHONE_RE, phoneMsg),
  password:  z.string().min(6, "Minimum 6 characters"),
});

const step2Schema = z.object({
  hasSpouse:             z.boolean(),
  spouseFirstName:       z.string().optional(),
  spouseLastName:        z.string().optional(),
  spouseEmail:           z.string().optional().refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Invalid email address" }),
  spousePhone:           z.string().optional().refine(v => !v || PHONE_RE.test(v), { message: phoneMsg }),
  houseStreet:           z.string().min(1, "House # & street required"),
  nearestBusStop:        z.string().optional(),
  city:                  z.string().optional(),
  emergencyContactName:  z.string().min(1, "Required"),
  emergencyContactPhone: z.string().regex(PHONE_RE, phoneMsg),
});

const childSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName:  z.string().min(1, "Required"),
  dobDay:    z.string().min(1, "Select day"),
  dobMonth:  z.string().min(1, "Select month"),
  dobYear:   z.string().min(1, "Select year"),
  gender:    z.enum(["male", "female"]),
  allergies: z.string().optional(),
});

const step3Schema = z.object({
  children: z.array(childSchema).min(1, "Add at least one child"),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const NOW = new Date();
const YEARS = Array.from({ length: 14 }, (_, i) => NOW.getFullYear() - 1 - i);
const DAYS  = Array.from({ length: 31 }, (_, i) => i + 1);

function calcAge(day: string, month: string, year: string): number | null {
  if (!day || !month || !year) return null;
  const dob = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(dob.getTime())) return null;
  let age = NOW.getFullYear() - dob.getFullYear();
  const m = NOW.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && NOW.getDate() < dob.getDate())) age--;
  return age;
}

const CLASS_COLORS = ["#9333ea","#7c3aed","#0369a1","#0369a1","#047857","#065f46","#b45309","#1e3a8a"];

function matchClassByAge(age: number | null, classes: any[]): { id: number; name: string; color: string } | null {
  if (age === null || !classes.length) return null;
  // Deduplicate by name, prefer lower id
  const seen = new Set<string>();
  const unique = classes.filter((c: any) => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
  const match = unique.find((c: any) => age >= (c.ageMin ?? 0) && age <= (c.ageMax ?? 99));
  if (!match) return null;
  const idx = unique.indexOf(match);
  return { id: match.id, name: match.name, color: CLASS_COLORS[idx % CLASS_COLORS.length] };
}

function buildDob(day: string, month: string, year: string) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Particles ─────────────────────────────────────────────────────────────────
function Particles() {
  const ps = Array.from({ length: 10 }, (_, i) => ({
    id: i, left: `${5 + i * 9}%`, delay: `${i * 0.8}s`,
    duration: `${9 + (i % 4) * 2}s`, size: i % 3 === 0 ? 18 : i % 3 === 1 ? 13 : 9,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {ps.map(p => (
        <div key={p.id} className="absolute" style={{ left: p.left, bottom: "-10%", fontSize: p.size, color: "rgba(26,35,126,0.06)", animation: `float-up ${p.duration} ${p.delay} linear infinite` }}>✝</div>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const iS = {
  background: "rgba(255,255,255,0.90)", border: "1.5px solid rgba(26,35,126,0.14)",
  color: "#0f172a", borderRadius: 12, padding: "12px 16px", fontSize: 14,
  width: "100%", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
};
const iIcon = { ...iS, paddingLeft: 40 };

const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = LOGO_NAVY;
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(26,35,126,0.10)";
};
const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "rgba(26,35,126,0.14)";
  e.currentTarget.style.boxShadow   = "none";
};

// ── Main component ────────────────────────────────────────────────────────────
export default function Register() {
  const [step, setStep] = useState<number | "otp" | "teacher-class">(1);
  const [, setLocation] = useLocation();
  const { login: localLogin } = useAuth();
  const { toast } = useToast();

  const [step1Data, setStep1Data] = useState<z.infer<typeof step1Schema> | null>(null);
  const [step2Data, setStep2Data] = useState<z.infer<typeof step2Schema> | null>(null);
  const [useSelfAsEmergency, setUseSelfAsEmergency] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"parent"|"teacher"|"admin"|"support">("parent");
  const [showPw, setShowPw] = useState(false);
  const [regPhotoUrl, setRegPhotoUrl] = useState("");
  const [selectedPrimaryClassId, setSelectedPrimaryClassId] = useState<number | null>(null);

  const [otpPinId, setOtpPinId]     = useState("");
  const [otpCode, setOtpCode]       = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent]       = useState(false);
  const [otpError, setOtpError]     = useState("");
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");

  const sendOtp = async (channel: "whatsapp" | "sms" | "email") => {
    if (!step1Data?.phone && channel !== "email") return;
    if (!step1Data?.email && channel === "email") return;
    setOtpSending(true); setOtpError(""); setOtpCode("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: step1Data!.phone, email: step1Data!.email, channel }),
      });
      const data = await res.json() as { pinId?: string; message?: string; error?: string };
      if (!res.ok) throw new Error(data.message ?? "Failed to send OTP");
      setOtpPinId(data.pinId ?? "");
      setOtpSent(true);
      setOtpChannel(channel);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Could not send code. Try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) { setOtpError("Enter the 6-digit code"); return; }
    setOtpVerifying(true); setOtpError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId: otpPinId, otp: otpCode }),
      });
      const data = await res.json() as { verified?: boolean; message?: string };
      if (!res.ok || !data.verified) throw new Error(data.message ?? "Incorrect code");
      if (selectedRole === "teacher") {
        // Teachers pick their class before submitting
        setStep("teacher-class");
      } else if (selectedRole !== "parent") {
        // Admins, support: register immediately
        await handleFinish();
      } else {
        setStep(2);
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setOtpVerifying(false);
    }
  };

  const regMutation    = useRegister();
  const famMutation    = useCreateFamily();
  const childMutation  = useCreateChild();
  const { data: classesList } = useListClasses({});

  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "" },
  });
  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      hasSpouse: false, spouseFirstName: "", spouseLastName: "", spouseEmail: "", spousePhone: "",
      houseStreet: "", nearestBusStop: "", city: "",
      emergencyContactName: "", emergencyContactPhone: "",
    },
  });
  const form3 = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: { children: [{ firstName: "", lastName: "", dobDay: "", dobMonth: "", dobYear: "", gender: "male", allergies: "" }] },
  });

  const { fields: childFields, append: appendChild, remove: removeChild } = useFieldArray({ control: form3.control, name: "children" });

  const onStep1 = (d: z.infer<typeof step1Schema>) => {
    setStep1Data(d);
    setStep("otp");
  };
  const onStep2 = (d: z.infer<typeof step2Schema>) => {
    setStep2Data(d);
    if (selectedRole !== "parent") {
      // Non-parents: skip child step, register immediately
      handleFinish(d);
    } else {
      form3.reset({ children: [{ firstName: "", lastName: step1Data?.lastName ?? "", dobDay: "", dobMonth: "", dobYear: "", gender: "male", allergies: "" }] });
      setStep(3);
    }
  };

  const handleFinish = async (s2?: z.infer<typeof step2Schema>, children?: z.infer<typeof step3Schema>["children"]) => {
    if (!step1Data) return;
    const s2d = s2 ?? step2Data;
    try {
      const authRes = await regMutation.mutateAsync({
        data: { firstName: step1Data.firstName, lastName: step1Data.lastName, email: step1Data.email, phone: step1Data.phone, password: step1Data.password, role: selectedRole, ...(selectedRole === "teacher" && selectedPrimaryClassId ? { primaryClassId: selectedPrimaryClassId } : {}) } as any
      }) as any;

      if (authRes.pending) {
        toast({ title: "Application Submitted!", description: "Your account is pending admin approval. You will be notified once approved." });
        setLocation("/login");
        return;
      }

      if (authRes.roleAdded) {
        toast({ title: "Role Added Successfully!", description: authRes.message });
        setLocation("/login");
        return;
      }

      localLogin(authRes.token, authRes.user);

      if (regPhotoUrl) {
        await fetch("/api/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authRes.token}` },
          body: JSON.stringify({ photoUrl: regPhotoUrl }),
        }).catch(() => {});
      }

      if (selectedRole === "parent" && s2d) {
        const addrParts = [s2d.houseStreet];
        if (s2d.nearestBusStop) addrParts.push(`Near: ${s2d.nearestBusStop}`);
        if (s2d.city) addrParts.push(s2d.city);

        const famRaw = await fetch("/api/families", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authRes.token}` },
          body: JSON.stringify({ parent1Id: authRes.user.id, parent2Id: null, address: addrParts.join(", "), emergencyContactName: s2d.emergencyContactName, emergencyContactPhone: s2d.emergencyContactPhone }),
        });
        if (!famRaw.ok) {
          const text = await famRaw.text();
          throw new Error(text.startsWith("<") ? `Family creation failed (${famRaw.status})` : text);
        }
        const famRes = await famRaw.json();

        for (const child of (children ?? [])) {
          const age = calcAge(child.dobDay, child.dobMonth, child.dobYear);
          const matched = matchClassByAge(age, (classesList as any[]) ?? []);
          const childRaw = await fetch("/api/children", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authRes.token}` },
            body: JSON.stringify({ familyId: famRes.id, firstName: child.firstName, lastName: child.lastName || step1Data.lastName, dob: buildDob(child.dobDay, child.dobMonth, child.dobYear), gender: child.gender, allergies: child.allergies, currentClassId: matched?.id ?? undefined }),
          });
          if (!childRaw.ok) {
            const text = await childRaw.text();
            throw new Error(text.startsWith("<") ? `Child creation failed (${childRaw.status})` : text);
          }
        }
      }

      setLocation(selectedRole === "parent" ? "/my-family" : "/dashboard");
    } catch {
      toast({ variant: "destructive", title: "Registration failed", description: "Please try again." });
    }
  };

  const onStep3 = (d: z.infer<typeof step3Schema>) => handleFinish(undefined, d.children);

  // ── Reusable field components ───────────────────────────────────────────────
  const Field = ({ form, name, label, icon: Icon, type = "text", ...rest }: any) => {
    const keys = name.split(".");
    let err: any = form.formState.errors;
    for (const k of keys) err = err?.[k];
    return (
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 z-10 w-4 h-4" style={{ top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />}
        <input {...form.register(name)} type={type} placeholder={label} style={Icon ? iIcon : iS} onFocus={focusIn} onBlur={focusOut} {...rest} />
        {err && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{err.message as string}</p>}
      </div>
    );
  };

  const Sel = ({ form, name, placeholder, children }: any) => {
    const keys = name.split(".");
    let err: any = form.formState.errors;
    for (const k of keys) err = err?.[k];
    return (
      <div>
        <select {...form.register(name)} style={iS} onFocus={focusIn} onBlur={focusOut}>
          {placeholder && <option value="">{placeholder}</option>}
          {children}
        </select>
        {err && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{err.message as string}</p>}
      </div>
    );
  };

  const Btn = ({ children, type = "submit", onClick, disabled, testId }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId}
      className="flex items-center justify-center gap-2 px-7 py-2.5 rounded-full font-semibold text-sm transition-all disabled:opacity-60"
      style={{ background: LOGO_NAVY, color: "#fff", boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}
      onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#283593"; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = LOGO_NAVY; }}
    >{children}</button>
  );

  const BackBtn = ({ onClick }: any) => (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all"
      style={{ background: "rgba(26,35,126,0.07)", color: LOGO_NAVY, border: "1px solid rgba(26,35,126,0.15)" }}
      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,35,126,0.12)"; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,35,126,0.07)"; }}
    >Back</button>
  );

  const ROLES = [
    { value: "parent",    label: "Parent",    emoji: "👪" },
    { value: "teacher",   label: "Teacher",   emoji: "📚" },
    { value: "admin",     label: "Admin",     emoji: "⚙️" },
    { value: "support", label: "Support", emoji: "🎟️" },
  ];


  const isSubmitting = regMutation.isPending;

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 20% 20%, #fde8d8 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #dbeafe 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, #fefcf9 0%, #f8fafc 100%)" }}
    >
      <Particles />

      {/* Logo */}
      <div className="logo-enter flex flex-col items-center z-10">
        <div className="rccg-logo-wrap" style={{ width: 140, height: 140, marginBottom: 16 }}>
          <img src="/rccg-logo-new.png" alt="RCCG Logo" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        </div>
      </div>

      {/* Title */}
      <div className="slide-up-delay-1 text-center mb-6 z-10">
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0a0f1e" }} className="text-3xl font-bold leading-tight">Register Family</h1>
        <p className="mt-1 text-sm font-medium" style={{ color: LOGO_NAVY }}>Shepherd Connect • City of David</p>
      </div>

      {/* Card */}
      <div className="slide-up-delay-2 w-full z-10" style={{ maxWidth: 500, borderRadius: 24, padding: 32, background: "rgba(255,255,255,0.78)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.92)", boxShadow: "0 8px 40px rgba(26,35,126,0.10)" }}>

        {/* Progress bar */}
        {(() => {
          const numericStep = step === "otp" ? 1 : (step as number);
          return (
            <div className="flex gap-2 mb-8">
              {(selectedRole === "parent" ? [1,2,3] : [1]).map(s => (
                <div key={s} className="flex-1 relative">
                  <div className="h-1.5 rounded-full transition-all duration-500" style={{ background: numericStep >= s ? LOGO_NAVY : "rgba(26,35,126,0.12)" }} />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold" style={{ color: numericStep >= s ? LOGO_NAVY : "#94a3b8" }}>STEP {s}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── STEP 1 — Account ── */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-3 animate-in fade-in zoom-in-95 duration-300">

            {/* Role selector */}
            <div>
              <p className="text-[11px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#64748b" }}>I am registering as</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setSelectedRole(r.value as any)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={selectedRole === r.value
                      ? { background: LOGO_NAVY, color: "#fff", boxShadow: "0 2px 8px rgba(26,35,126,0.25)" }
                      : { background: "rgba(26,35,126,0.05)", color: "#374151", border: "1px solid rgba(26,35,126,0.12)" }}
                  >
                    <span>{r.emoji}</span>{r.label}
                  </button>
                ))}
              </div>
              {selectedRole !== "parent" && (
                <p className="text-[11px] mt-2 px-1 text-gray-400">
                  If you are also a parent, you can register a separate parent account with a different email.
                </p>
              )}
            </div>

            <div className="flex justify-center mb-1">
              <PhotoUploader
                currentPhotoUrl={regPhotoUrl}
                fallbackLabel="?"
                onChange={setRegPhotoUrl}
                size="lg"
                shape="circle"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field form={form1} name="firstName" label="First Name"  icon={User} data-testid="reg-fname" />
              <Field form={form1} name="lastName"  label="Last Name"   data-testid="reg-lname" />
            </div>
            <Field form={form1} name="email" label="Email address" type="email" icon={Mail} data-testid="reg-email" />
            <Field form={form1} name="phone" label="Phone number"  icon={Phone} data-testid="reg-phone" />

            {/* Password with show/hide */}
            <div className="relative">
              <Lock className="absolute left-3.5 z-10 w-4 h-4" style={{ top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                {...form1.register("password")}
                type={showPw ? "text" : "password"}
                placeholder="Create password (min. 6 characters)"
                style={iIcon}
                onFocus={focusIn}
                onBlur={focusOut}
                data-testid="reg-pass"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {form1.formState.errors.password && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{form1.formState.errors.password.message}</p>}
            </div>

            <div className="flex justify-between items-center pt-5">
              <Link href="/login"><span className="text-sm font-medium cursor-pointer hover:opacity-70" style={{ color: "#64748b" }}>Back to login</span></Link>
              <Btn testId="reg-step1-next">Next <ChevronRight className="w-4 h-4" /></Btn>
            </div>
          </form>
        )}

        {/* ── STEP OTP — Phone verification ── */}
        {step === "otp" && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(26,35,126,0.08)" }}>
                <ShieldCheck className="w-7 h-7" style={{ color: LOGO_NAVY }} />
              </div>
              <h3 className="font-bold text-base" style={{ color: "#0f172a" }}>Verify your phone number</h3>
              <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                We'll send a 6-digit code to <span className="font-semibold" style={{ color: LOGO_NAVY }}>{step1Data?.phone}</span>
              </p>
            </div>

            {!otpSent ? (
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-center" style={{ color: "#94a3b8" }}>Choose how to receive your code</p>
                {[
                  { ch: "whatsapp" as const, icon: "💬", label: "Send via WhatsApp",   sub: "Recommended · instant delivery" },
                  { ch: "sms"      as const, icon: "📱", label: "Send via SMS",         sub: "Standard text message" },
                  { ch: "email"    as const, icon: "✉️",  label: "Send via Email",       sub: step1Data?.email ?? "" },
                ].map(({ ch, icon, label, sub }) => (
                  <button key={ch} type="button" onClick={() => sendOtp(ch)} disabled={otpSending}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-60 text-left"
                    style={{ background: "rgba(26,35,126,0.05)", border: "1.5px solid rgba(26,35,126,0.14)", color: "#0f172a" }}>
                    {otpSending ? <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" style={{ color: LOGO_NAVY }} /> : <span className="text-xl flex-shrink-0">{icon}</span>}
                    <span>
                      <span className="block font-bold" style={{ color: LOGO_NAVY }}>{label}</span>
                      <span className="block text-xs font-normal" style={{ color: "#94a3b8" }}>{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl text-center text-sm" style={{ background: "rgba(26,35,126,0.06)", border: "1px solid rgba(26,35,126,0.15)", color: LOGO_NAVY }}>
                  ✓ Code sent via {otpChannel === "whatsapp" ? "WhatsApp" : otpChannel === "email" ? "email" : "SMS"}
                  {otpChannel !== "email" && (
                    <span className="block text-xs mt-1" style={{ color: "#64748b" }}>
                      Also sent to your email inbox — check there if you don't receive it
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, "")); setOtpError(""); }}
                    style={{ ...iS, textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: 10, padding: "14px 16px" }}
                    onFocus={focusIn} onBlur={focusOut}
                    autoFocus
                  />
                </div>

                {otpError && <p className="text-xs text-center font-medium" style={{ color: "#b91c1c" }}>{otpError}</p>}

                <button type="button" onClick={verifyOtp} disabled={otpVerifying || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                  style={{ background: LOGO_NAVY, color: "#fff", boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}>
                  {otpVerifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <><Check className="w-4 h-4" /> Verify & Continue</>}
                </button>

                <button type="button" onClick={() => { setOtpSent(false); setOtpError(""); setOtpCode(""); }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium" style={{ color: "#94a3b8" }}>
                  <RefreshCw className="w-3 h-3" /> Resend or change channel
                </button>
              </div>
            )}

            {otpError && !otpSent && <p className="text-xs text-center font-medium" style={{ color: "#b91c1c" }}>{otpError}</p>}

            <div className="pt-1">
              <BackBtn onClick={() => setStep(1)} />
            </div>
          </div>
        )}

        {/* ── STEP TEACHER-CLASS — Class Selection (teachers only) ── */}
        {step === "teacher-class" && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(26,35,126,0.08)" }}>
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="font-bold text-base" style={{ color: "#0f172a" }}>Which class do you teach?</h3>
              <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                Select your permanent class. An admin can reassign you later if needed.
              </p>
            </div>

            <div className="space-y-2">
              {(() => {
                // Deduplicate classes by name (classes exist per service slot)
                const seen = new Set<string>();
                const unique = ((classesList as any[]) ?? []).filter((c: any) => {
                  if (seen.has(c.name)) return false;
                  seen.add(c.name);
                  return true;
                });
                return unique.map((cls: any, idx: number) => {
                  const color = CLASS_COLORS[idx % CLASS_COLORS.length];
                  const isSelected = selectedPrimaryClassId === cls.id;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedPrimaryClassId(cls.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm transition-all text-left"
                      style={isSelected
                        ? { background: LOGO_NAVY, color: "#fff", border: `2px solid ${LOGO_NAVY}`, boxShadow: "0 2px 12px rgba(26,35,126,0.20)" }
                        : { background: "rgba(26,35,126,0.04)", border: "1.5px solid rgba(26,35,126,0.14)", color: "#0f172a" }}
                    >
                      <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: color }}>
                        {cls.name.charAt(0)}
                      </span>
                      <span>
                        <span className="block font-bold" style={{ color: isSelected ? "#fff" : LOGO_NAVY }}>{cls.name}</span>
                        {(cls.ageMin != null && cls.ageMax != null) && (
                          <span className="block text-xs font-normal mt-0.5" style={{ color: isSelected ? "rgba(255,255,255,0.75)" : "#94a3b8" }}>
                            Ages {cls.ageMin}–{cls.ageMax}
                          </span>
                        )}
                      </span>
                      {isSelected && <span className="ml-auto text-white text-lg">✓</span>}
                    </button>
                  );
                });
              })()}
            </div>

            <p className="text-[11px] text-center" style={{ color: "#94a3b8" }}>
              Not sure? You can skip for now — an admin will assign you after approval.
            </p>

            <div className="flex justify-between items-center pt-2">
              <BackBtn onClick={() => setStep("otp")} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedPrimaryClassId(null); handleFinish(); }}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-full font-medium text-sm transition-all"
                  style={{ background: "rgba(26,35,126,0.07)", color: LOGO_NAVY, border: "1px solid rgba(26,35,126,0.15)" }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => handleFinish()}
                  disabled={isSubmitting || !selectedPrimaryClassId}
                  className="flex items-center gap-2 px-7 py-2.5 rounded-full font-semibold text-sm transition-all disabled:opacity-60"
                  style={{ background: LOGO_NAVY, color: "#fff", boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}
                >
                  {isSubmitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : <>Submit Application <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 — Details ── */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-3 animate-in fade-in zoom-in-95 duration-300">

            {/* Spouse toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "rgba(26,35,126,0.04)", border: "1px solid rgba(26,35,126,0.10)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "#0f172a" }}>Add Spouse / Co-parent</p>
                <p className="text-xs text-gray-500">Register a second guardian</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" {...form2.register("hasSpouse")} data-testid="reg-spouse-toggle" />
                <div className="w-11 h-6 rounded-full peer transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"
                  style={{ background: form2.watch("hasSpouse") ? LOGO_NAVY : "rgba(26,35,126,0.18)" }} />
              </label>
            </div>

            {form2.watch("hasSpouse") && (
              <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(26,35,126,0.03)", border: "1px solid rgba(26,35,126,0.10)" }}>
                <div className="grid grid-cols-2 gap-3">
                  <Field form={form2} name="spouseFirstName" label="Spouse First Name" />
                  <Field form={form2} name="spouseLastName"  label="Spouse Last Name" />
                </div>
                <Field form={form2} name="spouseEmail" label="Spouse Email" type="email" />
                <Field form={form2} name="spousePhone" label="Spouse Phone" />
              </div>
            )}

            {/* Structured address */}
            <div>
              <p className="text-[11px] font-bold mb-2 uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#64748b" }}>
                <Home className="w-3.5 h-3.5" /> Home Address
              </p>
              <div className="space-y-2">
                <Field form={form2} name="houseStreet"    label="House # & Street Name"            data-testid="reg-house-street" />
                <Field form={form2} name="nearestBusStop" label="Nearest Bus Stop (optional)" icon={Bus}    data-testid="reg-bus-stop" />
                <Field form={form2} name="city"           label="City / Area (e.g. Victoria Island)" icon={MapPin} data-testid="reg-city" />
              </div>
            </div>

            {/* Emergency contact */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold flex items-center gap-2" style={{ color: "#0f172a" }}>
                  <ShieldAlert className="w-4 h-4" style={{ color: LOGO_GREEN }} /> Emergency Contact
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const next = !useSelfAsEmergency;
                    setUseSelfAsEmergency(next);
                    if (next && step1Data) {
                      form2.setValue("emergencyContactName", `${step1Data.firstName} ${step1Data.lastName}`);
                      form2.setValue("emergencyContactPhone", step1Data.phone);
                    } else {
                      form2.setValue("emergencyContactName", "");
                      form2.setValue("emergencyContactPhone", "");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                  style={useSelfAsEmergency
                    ? { background: "#1b5e20", color: "white", borderColor: "#1b5e20" }
                    : { background: "white", color: "#1b5e20", borderColor: "#1b5e20" }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {useSelfAsEmergency ? "Using my details" : "Use my details"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field form={form2} name="emergencyContactName"  label="Contact Name"  data-testid="reg-emerg-name" />
                <Field form={form2} name="emergencyContactPhone" label="Contact Phone" data-testid="reg-emerg-phone" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-5">
              <BackBtn onClick={() => setStep("otp")} />
              <Btn testId="reg-step2-next" disabled={isSubmitting}>
                {selectedRole !== "parent" && isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  : selectedRole !== "parent"
                    ? <><Check className="w-4 h-4" /> Complete</>
                    : <>Next <ChevronRight className="w-4 h-4" /></>}
              </Btn>
            </div>
          </form>
        )}

        {/* ── STEP 3 — Children (parents only) ── */}
        {step === 3 && (
          <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="max-h-[48vh] overflow-y-auto pr-1 no-scrollbar space-y-4">
              {childFields.map((field, index) => {
                const day   = form3.watch(`children.${index}.dobDay`);
                const month = form3.watch(`children.${index}.dobMonth`);
                const year  = form3.watch(`children.${index}.dobYear`);
                const age   = calcAge(day, month, year);
                const cls   = matchClassByAge(age, (classesList as any[]) ?? []);
                return (
                  <div key={field.id} className="p-5 rounded-xl relative" style={{ background: "rgba(26,35,126,0.03)", border: "1px solid rgba(26,35,126,0.10)" }}>
                    {index > 0 && (
                      <button type="button" onClick={() => removeChild(index)}
                        className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                        style={{ background: "rgba(185,28,28,0.08)", color: "#b91c1c" }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = "#b91c1c"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(185,28,28,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#b91c1c"; }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <p className="font-bold text-sm mb-4" style={{ color: LOGO_NAVY }}>Child {index + 1}</p>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field form={form3} name={`children.${index}.firstName`} label="First Name" data-testid={`reg-child-fname-${index}`} />
                        <Field form={form3} name={`children.${index}.lastName`}  label="Last Name"  data-testid={`reg-child-lname-${index}`} />
                      </div>

                      {/* DOB — three dropdowns */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "#64748b" }}>Date of Birth</p>
                        <div className="grid grid-cols-3 gap-2">
                          <Sel form={form3} name={`children.${index}.dobDay`} placeholder="Day">
                            {DAYS.map(d => <option key={d} value={String(d)}>{d}</option>)}
                          </Sel>
                          <Sel form={form3} name={`children.${index}.dobMonth`} placeholder="Month">
                            {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                          </Sel>
                          <Sel form={form3} name={`children.${index}.dobYear`} placeholder="Year">
                            {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
                          </Sel>
                        </div>

                        {/* Class suggestion */}
                        {cls && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                            style={{ background: `${cls.color}18`, color: cls.color, border: `1px solid ${cls.color}35` }}>
                            ✓ Suggested: {cls.name}
                          </div>
                        )}
                        {age !== null && age < 1 && (
                          <p className="text-xs mt-1.5 text-amber-600">Child must be at least 1 year old to join a class.</p>
                        )}
                        {age !== null && age > 12 && (
                          <p className="text-xs mt-1.5 text-amber-600">Child is above the Junior Church age range (max 12 years).</p>
                        )}
                      </div>

                      {/* Gender */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "#64748b" }}>Gender</p>
                        <Sel form={form3} name={`children.${index}.gender`}>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </Sel>
                      </div>

                      <Field form={form3} name={`children.${index}.allergies`} label="Allergies / Medical Notes (Optional)" data-testid={`reg-child-allergies-${index}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button"
              onClick={() => appendChild({ firstName: "", lastName: step1Data?.lastName ?? "", dobDay: "", dobMonth: "", dobYear: "", gender: "male", allergies: "" })}
              className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
              style={{ border: "1.5px dashed rgba(26,35,126,0.25)", color: LOGO_NAVY, background: "transparent" }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,35,126,0.04)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Plus className="w-4 h-4" /> Add Another Child
            </button>

            <div className="flex justify-between items-center pt-4">
              <BackBtn onClick={() => setStep(2)} />
              <Btn disabled={isSubmitting} testId="reg-submit">
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  : <><Check className="w-4 h-4" /> Complete</>}
              </Btn>
            </div>
          </form>
        )}
      </div>

      <p className="mt-8 text-xs z-10 text-center" style={{ color: "#94a3b8" }}>
        © 2026 Junior Church, City of David · Victoria Island
      </p>
    </div>
  );
}
