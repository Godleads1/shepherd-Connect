import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useCreateFamily, useCreateChild } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Plus, Trash2, ChevronRight, Check, User, Mail, Phone, Lock, Home, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    left: `${5 + i * 8}%`,
    delay: `${i * 0.7}s`,
    duration: `${8 + (i % 4) * 2}s`,
    size: i % 3 === 0 ? 20 : i % 3 === 1 ? 14 : 10,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute text-white/10"
          style={{
            left: p.left,
            bottom: "-10%",
            fontSize: p.size,
            animation: `float-up ${p.duration} ${p.delay} linear infinite`,
          }}
        >
          ✝
        </div>
      ))}
    </div>
  );
}

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

  const { fields: childFields, append: appendChild, remove: removeChild } = useFieldArray({
    control: form3.control,
    name: "children",
  });

  const onStep1Submit = (data: z.infer<typeof step1Schema>) => {
    setStep1Data(data);
    setStep(2);
  };

  const onStep2Submit = (data: z.infer<typeof step2Schema>) => {
    setStep2Data(data);
    setStep(3);
  };

  const onStep3Submit = async (data: z.infer<typeof step3Schema>) => {
    if (!step1Data || !step2Data) return;

    try {
      // 1. Register main parent
      const authRes = await registerMutation.mutateAsync({
        data: {
          firstName: step1Data.firstName,
          lastName: step1Data.lastName,
          email: step1Data.email,
          phone: step1Data.phone,
          password: step1Data.password,
          role: "parent"
        }
      });
      
      localLogin(authRes.token, authRes.user);

      let parent2Id = null;

      // 2. Create Family
      const family = await createFamilyMutation.mutateAsync({
        data: {
          parent1Id: authRes.user.id,
          parent2Id: parent2Id,
          address: step2Data.address,
          emergencyContactName: step2Data.emergencyContactName,
          emergencyContactPhone: step2Data.emergencyContactPhone
        }
      });

      // 3. Create Children
      for (const child of data.children) {
        await createChildMutation.mutateAsync({
          data: {
            familyId: family.id,
            firstName: child.firstName,
            lastName: child.lastName || step1Data.lastName,
            dob: child.dob,
            gender: child.gender,
            allergies: child.allergies
          }
        });
      }

      toast({ title: "Registration complete!" });
      setLocation("/my-family");
    } catch (error) {
      toast({ variant: "destructive", title: "Registration failed", description: "Please try again." });
    }
  };

  const InputField = ({ form, name, label, icon: Icon, type = "text", ...props }: any) => {
    const error = form.formState.errors[name] || (name.includes('.') && form.formState.errors.children?.[name.split('.')[1]]?.[name.split('.')[2]]);
    return (
      <div className="relative mb-4">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />}
        <input
          {...form.register(name)}
          type={type}
          placeholder={label}
          className={`glass-input w-full rounded-xl py-3 text-sm focus:outline-none transition-all ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
          {...props}
        />
        {error && <p className="text-amber-300 text-xs mt-1 absolute -bottom-4 left-1">{error.message as string}</p>}
      </div>
    );
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 overflow-hidden"
      style={{ background: "linear-gradient(160deg, #172554 0%, #1e3a8a 50%, #1d4ed8 100%)" }}
    >
      <Particles />

      {/* Logo */}
      <div className="logo-enter flex flex-col items-center mb-8 z-10">
        <div
          className="logo-pulse w-24 h-24 rounded-full bg-white p-1.5 shadow-2xl"
          style={{ border: "2px solid white" }}
        >
          <img src="/rccg-logo.png" alt="RCCG Logo" className="w-full h-full rounded-full object-cover" />
        </div>
      </div>

      {/* Title */}
      <div className="slide-up-delay-1 text-center mb-6 z-10">
        <h1 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl font-bold text-white leading-tight">
          Register Family
        </h1>
        <p className="mt-1 text-sm text-amber-400 tracking-wide">Shepherd Connect • City of David</p>
      </div>

      {/* Glass Form Card */}
      <div className="slide-up-delay-2 glass w-full z-10 relative" style={{ maxWidth: 500, borderRadius: 24, padding: 32 }}>
        
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 relative">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= s ? 'bg-amber-400' : 'bg-white/20'}`} />
              <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold transition-all ${step >= s ? 'text-amber-400' : 'text-white/40'}`}>
                STEP {s}
              </div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <InputField form={form1} name="firstName" label="First Name" icon={User} data-testid="reg-fname" />
              <InputField form={form1} name="lastName" label="Last Name" data-testid="reg-lname" />
            </div>
            <InputField form={form1} name="email" label="Email address" type="email" icon={Mail} data-testid="reg-email" />
            <InputField form={form1} name="phone" label="Phone number" icon={Phone} data-testid="reg-phone" />
            <InputField form={form1} name="password" label="Create password" type="password" icon={Lock} data-testid="reg-pass" />
            
            <div className="flex justify-between items-center pt-6">
              <Link href="/login">
                <span className="text-sm font-medium text-white/60 hover:text-white cursor-pointer transition-colors">
                  Back to login
                </span>
              </Link>
              <button
                type="submit"
                data-testid="reg-step1-next"
                className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#172554", boxShadow: "0 4px 15px rgba(245,158,11,0.3)" }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
              <div>
                <p className="text-sm font-bold text-white">Add Spouse / Co-parent</p>
                <p className="text-xs text-white/60">Register a second guardian</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  {...form2.register("hasSpouse")} 
                  data-testid="reg-spouse-toggle"
                />
                <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
              </label>
            </div>
            
            {form2.watch("hasSpouse") && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4 space-y-2">
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <InputField form={form2} name="spouseFirstName" label="Spouse First Name" />
                  <InputField form={form2} name="spouseLastName" label="Spouse Last Name" />
                </div>
                <InputField form={form2} name="spouseEmail" label="Spouse Email" type="email" />
                <InputField form={form2} name="spousePhone" label="Spouse Phone" />
              </div>
            )}

            <InputField form={form2} name="address" label="Home Address" icon={Home} data-testid="reg-address" />
            
            <div className="mt-6 mb-2">
              <p className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-400" /> Emergency Contact</p>
              <div className="grid grid-cols-2 gap-3">
                <InputField form={form2} name="emergencyContactName" label="Contact Name" data-testid="reg-emerg-name" />
                <InputField form={form2} name="emergencyContactPhone" label="Contact Phone" data-testid="reg-emerg-phone" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white/80 bg-white/10 hover:bg-white/20 transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                data-testid="reg-step2-next"
                className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#172554", boxShadow: "0 4px 15px rgba(245,158,11,0.3)" }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={form3.handleSubmit(onStep3Submit)} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="max-h-[50vh] overflow-y-auto pr-2 no-scrollbar space-y-4">
              {childFields.map((field, index) => (
                <div key={field.id} className="p-5 rounded-xl bg-white/5 border border-white/10 relative">
                  {index > 0 && (
                    <button type="button" className="absolute right-3 top-3 w-8 h-8 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors" onClick={() => removeChild(index)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <h4 className="font-bold text-amber-400 mb-4">Child {index + 1}</h4>
                  
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <InputField form={form3} name={`children.${index}.firstName`} label="First Name" data-testid={`reg-child-fname-${index}`} />
                    <InputField form={form3} name={`children.${index}.lastName`} label="Last Name" data-testid={`reg-child-lname-${index}`} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="relative mb-4">
                      <input
                        {...form3.register(`children.${index}.dob`)}
                        type="date"
                        className="glass-input w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all [&::-webkit-calendar-picker-indicator]:invert"
                        data-testid={`reg-child-dob-${index}`}
                      />
                      {form3.formState.errors.children?.[index]?.dob && <p className="text-amber-300 text-xs mt-1 absolute -bottom-4 left-1">{form3.formState.errors.children[index]?.dob?.message as string}</p>}
                    </div>
                    
                    <div className="relative mb-4">
                      <select
                        {...form3.register(`children.${index}.gender`)}
                        className="glass-input w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all appearance-none"
                        data-testid={`reg-child-gender-${index}`}
                      >
                        <option value="male" className="text-black">Male</option>
                        <option value="female" className="text-black">Female</option>
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                  
                  <InputField form={form3} name={`children.${index}.allergies`} label="Allergies / Medical Notes (Optional)" data-testid={`reg-child-allergies-${index}`} />
                </div>
              ))}
            </div>

            <button 
              type="button" 
              onClick={() => appendChild({ firstName: "", lastName: step1Data?.lastName || "", dob: "", gender: "male", allergies: "" })}
              className="w-full py-3 rounded-xl border border-dashed border-white/30 text-white/80 hover:text-white hover:border-white hover:bg-white/5 transition-all flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Plus className="w-4 h-4" /> Add Another Child
            </button>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white/80 bg-white/10 hover:bg-white/20 transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={registerMutation.isPending || createFamilyMutation.isPending || createChildMutation.isPending}
                data-testid="reg-submit"
                className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#172554", boxShadow: "0 4px 15px rgba(245,158,11,0.3)" }}
              >
                {registerMutation.isPending ? "Processing..." : <><Check className="w-4 h-4" /> Complete</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
