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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploader } from "@/components/PhotoUploader";

const LOGO_NAVY  = "#1a237e";
const LOGO_GREEN = "#1b5e20";

// ── Schemas ──────────────────────────────────────────────────────────────────
const step1Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName:  z.string().min(1, "Required"),
  email:     z.string().email("Invalid email"),
  phone:     z.string().min(1, "Required"),
  password:  z.string().min(6, "Minimum 6 characters"),
});

const step2Schema = z.object({
  hasSpouse:             z.boolean(),
  spouseFirstName:       z.string().optional(),
  spouseLastName:        z.string().optional(),
  spouseEmail:           z.string().optional(),
  spousePhone:           z.string().optional(),
  houseStreet:           z.string().min(1, "House # & street required"),
  nearestBusStop:        z.string().optional(),
  city:                  z.string().optional(),
  serviceTime:           z.enum(["first", "second", "both"]),
  emergencyContactName:  z.string().min(1, "Required"),
  emergencyContactPhone: z.string().min(1, "Required"),
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
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { login: localLogin } = useAuth();
  const { toast } = useToast();

  const [step1Data, setStep1Data] = useState<z.infer<typeof step1Schema> | null>(null);
  const [step2Data, setStep2Data] = useState<z.infer<typeof step2Schema> | null>(null);
  const [selectedRole, setSelectedRole] = useState<"parent"|"teacher"|"admin"|"attendant">("parent");
  const [showPw, setShowPw] = useState(false);
  const [regPhotoUrl, setRegPhotoUrl] = useState("");

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
      houseStreet: "", nearestBusStop: "", city: "", serviceTime: "first",
      emergencyContactName: "", emergencyContactPhone: "",
    },
  });
  const form3 = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: { children: [{ firstName: "", lastName: "", dobDay: "", dobMonth: "", dobYear: "", gender: "male", allergies: "" }] },
  });

  const { fields: childFields, append: appendChild, remove: removeChild } = useFieldArray({ control: form3.control, name: "children" });

  const onStep1 = (d: z.infer<typeof step1Schema>) => { setStep1Data(d); setStep(2); };
  const onStep2 = (d: z.infer<typeof step2Schema>) => {
    setStep2Data(d);
    if (selectedRole !== "parent") {
      // Non-parents: skip child step, register immediately
      handleFinish(d);
    } else {
      setStep(3);
    }
  };

  const handleFinish = async (s2?: z.infer<typeof step2Schema>, children?: z.infer<typeof step3Schema>["children"]) => {
    if (!step1Data) return;
    const s2d = s2 ?? step2Data;
    try {
      const authRes = await regMutation.mutateAsync({
        data: { firstName: step1Data.firstName, lastName: step1Data.lastName, email: step1Data.email, phone: step1Data.phone, password: step1Data.password, role: selectedRole }
      });
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
        const svcLabel = s2d.serviceTime === "first" ? "1st Service (7:00–10:00 AM)" : s2d.serviceTime === "second" ? "2nd Service (10:30 AM)" : "Both Services";
        addrParts.push(`[${svcLabel}]`);

        const fam = await famMutation.mutateAsync({
          data: { parent1Id: authRes.user.id, parent2Id: null, address: addrParts.join(", "), emergencyContactName: s2d.emergencyContactName, emergencyContactPhone: s2d.emergencyContactPhone }
        });
        for (const child of (children ?? [])) {
          const age = calcAge(child.dobDay, child.dobMonth, child.dobYear);
          const matched = matchClassByAge(age, (classesList as any[]) ?? []);
          await childMutation.mutateAsync({
            data: { familyId: fam.id, firstName: child.firstName, lastName: child.lastName || step1Data.lastName, dob: buildDob(child.dobDay, child.dobMonth, child.dobYear), gender: child.gender, allergies: child.allergies, currentClassId: matched?.id ?? undefined }
          });
        }
        setLocation("/my-family");
      } else {
        setLocation("/dashboard");
      }
      toast({ title: "Registration complete!" });
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
    { value: "attendant", label: "Attendant", emoji: "🎟️" },
  ];

  const SVC = [
    { value: "first",  label: "1st Service", sub: "7:00 – 10:00 AM (Sunday)" },
    { value: "second", label: "2nd Service", sub: "10:30 AM onwards (Sunday)" },
    { value: "both",   label: "Both",        sub: "Attend all Sunday services" },
  ];

  const isSubmitting = regMutation.isPending || famMutation.isPending || childMutation.isPending;

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
        <div className="flex gap-2 mb-8">
          {(selectedRole === "parent" ? [1,2,3] : [1,2]).map(s => (
            <div key={s} className="flex-1 relative">
              <div className="h-1.5 rounded-full transition-all duration-500" style={{ background: step >= s ? LOGO_NAVY : "rgba(26,35,126,0.12)" }} />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold" style={{ color: step >= s ? LOGO_NAVY : "#94a3b8" }}>STEP {s}</div>
            </div>
          ))}
        </div>

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

            {/* Service time — only shown for parents */}
            {selectedRole === "parent" && (
              <div>
                <p className="text-[11px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#64748b" }}>Which service do you attend?</p>
                <div className="grid grid-cols-3 gap-2">
                  {SVC.map(s => (
                    <label key={s.value}
                      className="flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer text-center transition-all"
                      style={form2.watch("serviceTime") === s.value
                        ? { background: LOGO_NAVY, color: "#fff", boxShadow: "0 2px 8px rgba(26,35,126,0.25)" }
                        : { background: "rgba(26,35,126,0.04)", color: "#374151", border: "1px solid rgba(26,35,126,0.12)" }}
                    >
                      <input type="radio" {...form2.register("serviceTime")} value={s.value} className="sr-only" />
                      <span className="text-xs font-bold">{s.label}</span>
                      <span className="text-[10px] mt-0.5 opacity-80">{s.sub}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency contact */}
            <div className="pt-1">
              <p className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#0f172a" }}>
                <ShieldAlert className="w-4 h-4" style={{ color: LOGO_GREEN }} /> Emergency Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field form={form2} name="emergencyContactName"  label="Contact Name"  data-testid="reg-emerg-name" />
                <Field form={form2} name="emergencyContactPhone" label="Contact Phone" data-testid="reg-emerg-phone" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-5">
              <BackBtn onClick={() => setStep(1)} />
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
