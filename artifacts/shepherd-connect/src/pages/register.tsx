import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useCreateFamily, useCreateChild } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Plus, Trash2, ChevronRight, Check, User, Mail, Phone, Lock, Home, ShieldAlert, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Brand palette derived from RCCG logo ──
const LOGO_NAVY  = "#1a237e";
const LOGO_GREEN = "#1b5e20";

const step1Schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Required"),
  password: z.string().min(6, "Minimum 6 characters"),
});

const step2Schema = z.object({
  hasSpouse: z.boolean(),
  spouseFirstName: z.string().optional(),
  spouseLastName: z.string().optional(),
  spouseEmail: z.string().optional(),
  spousePhone: z.string().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().min(1, "Required"),
  emergencyContactPhone: z.string().min(1, "Required"),
});

const childSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dob: z.string().min(1, "Required"),
  gender: z.enum(["male", "female"]),
  allergies: z.string().optional(),
});

const step3Schema = z.object({
  children: z.array(childSchema).min(1, "Add at least one child"),
});

function Particles() {
  const particles = Array.from({ length: 10 }, (_, i) => ({
    id: i, left: `${5 + i * 9}%`, delay: `${i * 0.8}s`,
    duration: `${9 + (i % 4) * 2}s`, size: i % 3 === 0 ? 18 : i % 3 === 1 ? 13 : 9,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map(p => (
        <div key={p.id} className="absolute" style={{ left: p.left, bottom: "-10%", fontSize: p.size, color: "rgba(26,35,126,0.06)", animation: `float-up ${p.duration} ${p.delay} linear infinite` }}>✝</div>
      ))}
    </div>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.90)",
  border: "1.5px solid rgba(26,35,126,0.14)",
  color: "#0f172a",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  width: "100%",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const inputWithIconStyle = { ...inputStyle, paddingLeft: 40 };

export default function Register() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { login: localLogin } = useAuth();
  const { toast } = useToast();

  const [step1Data, setStep1Data] = useState<z.infer<typeof step1Schema> | null>(null);
  const [step2Data, setStep2Data] = useState<z.infer<typeof step2Schema> | null>(null);

  const registerMutation = useRegister();
  const createFamilyMutation = useCreateFamily();
  const createChildMutation = useCreateChild();

  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "" },
  });

  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { hasSpouse: false, spouseFirstName: "", spouseLastName: "", spouseEmail: "", spousePhone: "", address: "", emergencyContactName: "", emergencyContactPhone: "" },
  });

  const form3 = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: { children: [{ firstName: "", lastName: "", dob: "", gender: "male", allergies: "" }] },
  });

  const { fields: childFields, append: appendChild, remove: removeChild } = useFieldArray({ control: form3.control, name: "children" });

  const onStep1Submit = (data: z.infer<typeof step1Schema>) => { setStep1Data(data); setStep(2); };
  const onStep2Submit = (data: z.infer<typeof step2Schema>) => { setStep2Data(data); setStep(3); };

  const onStep3Submit = async (data: z.infer<typeof step3Schema>) => {
    if (!step1Data || !step2Data) return;
    try {
      const authRes = await registerMutation.mutateAsync({
        data: { firstName: step1Data.firstName, lastName: step1Data.lastName, email: step1Data.email, phone: step1Data.phone, password: step1Data.password, role: "parent" }
      });
      localLogin(authRes.token, authRes.user);
      const family = await createFamilyMutation.mutateAsync({
        data: { parent1Id: authRes.user.id, parent2Id: null, address: step2Data.address, emergencyContactName: step2Data.emergencyContactName, emergencyContactPhone: step2Data.emergencyContactPhone }
      });
      for (const child of data.children) {
        await createChildMutation.mutateAsync({
          data: { familyId: family.id, firstName: child.firstName, lastName: child.lastName || step1Data.lastName, dob: child.dob, gender: child.gender, allergies: child.allergies }
        });
      }
      toast({ title: "Registration complete!" });
      setLocation("/my-family");
    } catch {
      toast({ variant: "destructive", title: "Registration failed", description: "Please try again." });
    }
  };

  const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = LOGO_NAVY; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(26,35,126,0.10)"; };
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = "rgba(26,35,126,0.14)"; e.currentTarget.style.boxShadow = "none"; };

  // Shared labelled input component
  const Field = ({ form, name, label, icon: Icon, type = "text", ...rest }: any) => {
    const keys = name.split(".");
    let err: any = form.formState.errors;
    for (const k of keys) err = err?.[k];
    return (
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 z-10 w-4 h-4" style={{ top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />}
        <input
          {...form.register(name)}
          type={type}
          placeholder={label}
          style={Icon ? inputWithIconStyle : inputStyle}
          onFocus={focusIn}
          onBlur={focusOut}
          {...rest}
        />
        {err && <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{err.message as string}</p>}
      </div>
    );
  };

  const PrimaryBtn = ({ children, type = "submit", onClick, disabled, testId }: any) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex items-center justify-center gap-2 px-7 py-2.5 rounded-full font-semibold text-sm transition-all disabled:opacity-60"
      style={{ background: LOGO_NAVY, color: "#fff", boxShadow: "0 4px 14px rgba(26,35,126,0.25)", letterSpacing: "0.02em" }}
      onMouseOver={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#283593"; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = LOGO_NAVY; }}
    >
      {children}
    </button>
  );

  const SecondaryBtn = ({ children, onClick }: any) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all"
      style={{ background: "rgba(26,35,126,0.07)", color: LOGO_NAVY, border: `1px solid rgba(26,35,126,0.15)` }}
      onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,35,126,0.12)"; }}
      onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,35,126,0.07)"; }}
    >
      {children}
    </button>
  );

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 20% 20%, #fde8d8 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #dbeafe 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, #fefcf9 0%, #f8fafc 100%)" }}
    >
      <Particles />

      {/* Logo */}
      <div className="logo-enter flex flex-col items-center mb-6 z-10">
        <img
          src="/rccg-logo.png"
          alt="RCCG Logo"
          style={{ width: 120, height: 120, objectFit: "contain", display: "block" }}
        />
      </div>

      {/* Title */}
      <div className="slide-up-delay-1 text-center mb-6 z-10">
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0a0f1e" }} className="text-3xl font-bold leading-tight">
          Register Family
        </h1>
        <p className="mt-1 text-sm font-medium" style={{ color: LOGO_NAVY }}>Shepherd Connect • City of David</p>
      </div>

      {/* Form Card */}
      <div
        className="slide-up-delay-2 w-full z-10"
        style={{
          maxWidth: 500, borderRadius: 24, padding: 32,
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.92)",
          boxShadow: "0 8px 40px rgba(26,35,126,0.10)",
        }}
      >
        {/* Step progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 relative">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ background: step >= s ? LOGO_NAVY : "rgba(26,35,126,0.12)" }}
              />
              <div
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold transition-all"
                style={{ color: step >= s ? LOGO_NAVY : "#94a3b8" }}
              >
                STEP {s}
              </div>
            </div>
          ))}
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-2 gap-3">
              <Field form={form1} name="firstName" label="First Name" icon={User} data-testid="reg-fname" />
              <Field form={form1} name="lastName" label="Last Name" data-testid="reg-lname" />
            </div>
            <Field form={form1} name="email" label="Email address" type="email" icon={Mail} data-testid="reg-email" />
            <Field form={form1} name="phone" label="Phone number" icon={Phone} data-testid="reg-phone" />
            <Field form={form1} name="password" label="Create password" type="password" icon={Lock} data-testid="reg-pass" />

            <div className="flex justify-between items-center pt-5">
              <Link href="/login">
                <span className="text-sm font-medium cursor-pointer transition-opacity hover:opacity-70" style={{ color: "#64748b" }}>
                  Back to login
                </span>
              </Link>
              <PrimaryBtn testId="reg-step1-next">
                Next <ChevronRight className="w-4 h-4" />
              </PrimaryBtn>
            </div>
          </form>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
            {/* Spouse toggle */}
            <div
              className="flex items-center justify-between p-4 rounded-xl mb-2"
              style={{ background: "rgba(26,35,126,0.04)", border: "1px solid rgba(26,35,126,0.10)" }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: "#0f172a" }}>Add Spouse / Co-parent</p>
                <p className="text-xs" style={{ color: "#64748b" }}>Register a second guardian</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" {...form2.register("hasSpouse")} data-testid="reg-spouse-toggle" />
                <div
                  className="w-11 h-6 rounded-full peer transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"
                  style={{ background: form2.watch("hasSpouse") ? LOGO_NAVY : "rgba(26,35,126,0.18)" }}
                />
              </label>
            </div>

            {form2.watch("hasSpouse") && (
              <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(26,35,126,0.03)", border: "1px solid rgba(26,35,126,0.10)" }}>
                <div className="grid grid-cols-2 gap-3">
                  <Field form={form2} name="spouseFirstName" label="Spouse First Name" />
                  <Field form={form2} name="spouseLastName" label="Spouse Last Name" />
                </div>
                <Field form={form2} name="spouseEmail" label="Spouse Email" type="email" />
                <Field form={form2} name="spousePhone" label="Spouse Phone" />
              </div>
            )}

            <Field form={form2} name="address" label="Home Address" icon={Home} data-testid="reg-address" />

            <div className="pt-2">
              <p className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#0f172a" }}>
                <ShieldAlert className="w-4 h-4" style={{ color: LOGO_GREEN }} /> Emergency Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field form={form2} name="emergencyContactName" label="Contact Name" data-testid="reg-emerg-name" />
                <Field form={form2} name="emergencyContactPhone" label="Contact Phone" data-testid="reg-emerg-phone" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-5">
              <SecondaryBtn onClick={() => setStep(1)}>Back</SecondaryBtn>
              <PrimaryBtn testId="reg-step2-next">
                Next <ChevronRight className="w-4 h-4" />
              </PrimaryBtn>
            </div>
          </form>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <form onSubmit={form3.handleSubmit(onStep3Submit)} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="max-h-[46vh] overflow-y-auto pr-1 no-scrollbar space-y-4">
              {childFields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-5 rounded-xl relative"
                  style={{ background: "rgba(26,35,126,0.03)", border: "1px solid rgba(26,35,126,0.10)" }}
                >
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeChild(index)}
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
                      <Field form={form3} name={`children.${index}.lastName`} label="Last Name" data-testid={`reg-child-lname-${index}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input
                          {...form3.register(`children.${index}.dob`)}
                          type="date"
                          style={inputStyle}
                          onFocus={focusIn}
                          onBlur={focusOut}
                          data-testid={`reg-child-dob-${index}`}
                        />
                        {form3.formState.errors.children?.[index]?.dob && (
                          <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>{form3.formState.errors.children[index]?.dob?.message}</p>
                        )}
                      </div>
                      <div>
                        <select
                          {...form3.register(`children.${index}.gender`)}
                          style={inputStyle}
                          onFocus={focusIn}
                          onBlur={focusOut}
                          data-testid={`reg-child-gender-${index}`}
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                    </div>
                    <Field form={form3} name={`children.${index}.allergies`} label="Allergies / Medical Notes (Optional)" data-testid={`reg-child-allergies-${index}`} />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => appendChild({ firstName: "", lastName: step1Data?.lastName || "", dob: "", gender: "male", allergies: "" })}
              className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
              style={{ border: `1.5px dashed rgba(26,35,126,0.25)`, color: LOGO_NAVY, background: "transparent" }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(26,35,126,0.04)"; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <Plus className="w-4 h-4" /> Add Another Child
            </button>

            <div className="flex justify-between items-center pt-4">
              <SecondaryBtn onClick={() => setStep(2)}>Back</SecondaryBtn>
              <PrimaryBtn
                disabled={registerMutation.isPending || createFamilyMutation.isPending || createChildMutation.isPending}
                testId="reg-submit"
              >
                {registerMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  : <><Check className="w-4 h-4" /> Complete</>}
              </PrimaryBtn>
            </div>
          </form>
        )}
      </div>

      <p className="mt-8 text-xs z-10 text-center" style={{ color: "#94a3b8" }}>
        © 2026 Children Church, City of David · Victoria Island
      </p>
    </div>
  );
}
