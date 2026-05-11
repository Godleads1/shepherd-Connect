import { useState } from "react";
import { useListFamilies, useCreateFamily, useCreateChild } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api-call";
import {
  Search, Eye, Users, Plus, Phone, MapPin, Home,
  ShieldAlert, ChevronRight, Check, Loader2, Trash2, Bus,
} from "lucide-react";

// ── Schemas ───────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  parent1Id: z.string().min(1, "Select a primary parent"),
  hasSpouse: z.boolean(),
  parent2Id: z.string().optional(),
});

const step2Schema = z.object({
  houseStreet:           z.string().min(1, "House # & street required"),
  nearestBusStop:        z.string().optional(),
  city:                  z.string().optional(),
  serviceTime:           z.enum(["first", "second", "both"]),
  emergencyContactName:  z.string().min(1, "Emergency contact name required"),
  emergencyContactPhone: z.string().min(1, "Emergency contact phone required"),
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

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const NOW   = new Date();
const YEARS = Array.from({ length: 14 }, (_, i) => NOW.getFullYear() - 1 - i);
const DAYS  = Array.from({ length: 31 }, (_, i) => i + 1);

function buildDob(day: string, month: string, year: string) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SVC = [
  { value: "first",  label: "1st Service", sub: "7:00 – 10:00 am" },
  { value: "second", label: "2nd Service", sub: "10:30 am onwards" },
  { value: "both",   label: "Both",        sub: "All services"     },
];

const NAVY = "#1a237e";

// ── Shared styled input/select helpers ────────────────────────────────────────

const iS = {
  background: "rgba(255,255,255,0.95)", border: "1.5px solid rgba(26,35,126,0.18)",
  color: "#0f172a", borderRadius: 10, padding: "10px 14px", fontSize: 14,
  width: "100%", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
};
const iIcon = { ...iS, paddingLeft: 38 };
const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = NAVY;
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(26,35,126,0.10)";
};
const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "rgba(26,35,126,0.18)";
  e.currentTarget.style.boxShadow   = "none";
};

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs mt-1 text-red-600">{msg}</p> : null;
}

// ── Wizard dialog ─────────────────────────────────────────────────────────────

function AddFamilyWizard({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [step, setStep] = useState(1);
  const [s1, setS1] = useState<z.infer<typeof step1Schema> | null>(null);
  const [s2, setS2] = useState<z.infer<typeof step2Schema> | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const createFamily = useCreateFamily();
  const createChild  = useCreateChild();

  const { data: usersData } = useQuery({
    queryKey: ["parent-users-for-family"],
    queryFn: () => apiGet<{ data: any[]; total: number }>("/users?role=parent&limit=200"),
    enabled: open,
  });
  const parents = usersData?.data ?? [];

  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { parent1Id: "", hasSpouse: false, parent2Id: "" },
  });
  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      houseStreet: "", nearestBusStop: "", city: "",
      serviceTime: "first", emergencyContactName: "", emergencyContactPhone: "",
    },
  });
  const form3 = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      children: [{ firstName: "", lastName: "", dobDay: "", dobMonth: "", dobYear: "", gender: "male", allergies: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form3.control, name: "children" });

  const handleClose = () => {
    setStep(1); form1.reset(); form2.reset(); form3.reset(); setS1(null); setS2(null);
    onClose();
  };

  const onStep1 = (d: z.infer<typeof step1Schema>) => { setS1(d); setStep(2); };
  const onStep2 = (d: z.infer<typeof step2Schema>) => { setS2(d); setStep(3); };

  const onStep3 = async (d: z.infer<typeof step3Schema>) => {
    if (!s1 || !s2) return;
    setBusy(true);
    try {
      const addrParts = [s2.houseStreet];
      if (s2.nearestBusStop) addrParts.push(`Near: ${s2.nearestBusStop}`);
      if (s2.city) addrParts.push(s2.city);
      const svcLabel = s2.serviceTime === "first" ? "1st Service (7am)"
        : s2.serviceTime === "second" ? "2nd Service (10:30am)" : "Both Services";
      addrParts.push(`[${svcLabel}]`);

      const body: any = {
        parent1Id: Number(s1.parent1Id),
        address: addrParts.join(", "),
        emergencyContactName: s2.emergencyContactName,
        emergencyContactPhone: s2.emergencyContactPhone,
      };
      if (s1.hasSpouse && s1.parent2Id) body.parent2Id = Number(s1.parent2Id);

      const fam = await createFamily.mutateAsync({ data: body });

      for (const child of d.children) {
        await createChild.mutateAsync({
          data: {
            familyId: fam.id,
            firstName: child.firstName,
            lastName: child.lastName,
            dob: buildDob(child.dobDay, child.dobMonth, child.dobYear),
            gender: child.gender,
            allergies: child.allergies || undefined,
          },
        });
      }

      toast({ title: "Family created!", description: "The new family record has been saved." });
      handleClose();
      onCreated(fam.id);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not create family", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const hasSpouse = form1.watch("hasSpouse");
  const p1Id      = form1.watch("parent1Id");

  const totalSteps = 3;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }} className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: NAVY }} /> Add New Family
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-2 pt-1 pb-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
            <div key={s} className="flex-1 relative">
              <div className="h-1.5 rounded-full transition-all duration-500"
                style={{ background: step >= s ? NAVY : "rgba(26,35,126,0.12)" }} />
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold"
                style={{ color: step >= s ? NAVY : "#94a3b8" }}>STEP {s}</div>
            </div>
          ))}
        </div>

        {/* ── Step 1: Parents ── */}
        {step === 1 && (
          <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4 mt-1 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <p className="text-[11px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#64748b" }}>Primary Parent</p>
              <div className="relative">
                <select
                  {...form1.register("parent1Id")}
                  style={iS}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  <option value="">— Select primary parent —</option>
                  {parents.map((u: any) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.firstName} {u.lastName} — {u.email}
                    </option>
                  ))}
                </select>
                <Err msg={form1.formState.errors.parent1Id?.message} />
              </div>
            </div>

            {/* Spouse toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "rgba(26,35,126,0.04)", border: "1px solid rgba(26,35,126,0.10)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "#0f172a" }}>Add Spouse / Co-parent</p>
                <p className="text-xs text-gray-500">Register a second guardian</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" {...form1.register("hasSpouse")} />
                <div className="w-11 h-6 rounded-full peer transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"
                  style={{ background: hasSpouse ? NAVY : "rgba(26,35,126,0.18)" }} />
              </label>
            </div>

            {hasSpouse && (
              <div className="space-y-2 p-4 rounded-xl"
                style={{ background: "rgba(26,35,126,0.03)", border: "1px solid rgba(26,35,126,0.10)" }}>
                <p className="text-[11px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#64748b" }}>Second Parent</p>
                <select
                  {...form1.register("parent2Id")}
                  style={iS}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  <option value="">— Select second parent —</option>
                  {parents.filter((u: any) => String(u.id) !== p1Id).map((u: any) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.firstName} {u.lastName} — {u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm text-white transition-all"
                style={{ background: NAVY, boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Family details ── */}
        {step === 2 && (
          <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4 mt-1 animate-in fade-in zoom-in-95 duration-300">

            <div>
              <p className="text-[11px] font-bold mb-2 uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#64748b" }}>
                <Home className="w-3.5 h-3.5" /> Home Address
              </p>
              <div className="space-y-2">
                <div>
                  <input {...form2.register("houseStreet")} placeholder="House # & Street Name"
                    style={iS} onFocus={onFocus} onBlur={onBlur} />
                  <Err msg={form2.formState.errors.houseStreet?.message} />
                </div>
                <div className="relative">
                  <Bus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input {...form2.register("nearestBusStop")} placeholder="Nearest Bus Stop (optional)"
                    style={iIcon} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input {...form2.register("city")} placeholder="City / Area (e.g. Victoria Island)"
                    style={iIcon} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#64748b" }}>Which service do you attend?</p>
              <div className="grid grid-cols-3 gap-2">
                {SVC.map(s => (
                  <label key={s.value}
                    className="flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer text-center transition-all"
                    style={form2.watch("serviceTime") === s.value
                      ? { background: NAVY, color: "#fff", boxShadow: "0 2px 8px rgba(26,35,126,0.25)" }
                      : { background: "rgba(26,35,126,0.04)", color: "#374151", border: "1px solid rgba(26,35,126,0.12)" }}>
                    <input type="radio" {...form2.register("serviceTime")} value={s.value} className="sr-only" />
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className="text-[10px] mt-0.5 opacity-80">{s.sub}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#0f172a" }}>
                <ShieldAlert className="w-4 h-4 text-green-700" /> Emergency Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input {...form2.register("emergencyContactName")} placeholder="Contact Name"
                    style={iS} onFocus={onFocus} onBlur={onBlur} />
                  <Err msg={form2.formState.errors.emergencyContactName?.message} />
                </div>
                <div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input {...form2.register("emergencyContactPhone")} placeholder="Phone number"
                      style={iIcon} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                  <Err msg={form2.formState.errors.emergencyContactPhone?.message} />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all"
                style={{ background: "rgba(26,35,126,0.07)", color: NAVY, border: "1px solid rgba(26,35,126,0.15)" }}>
                Back
              </button>
              <button type="submit"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm text-white transition-all"
                style={{ background: NAVY, boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Children ── */}
        {step === 3 && (
          <form onSubmit={form3.handleSubmit(onStep3)} className="space-y-4 mt-1 animate-in fade-in zoom-in-95 duration-300">
            <div className="max-h-[46vh] overflow-y-auto pr-1 space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 rounded-xl relative space-y-3"
                  style={{ background: "rgba(26,35,126,0.03)", border: "1px solid rgba(26,35,126,0.10)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                      Child {index + 1}
                    </p>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)}
                        className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input {...form3.register(`children.${index}.firstName`)} placeholder="First Name"
                        style={iS} onFocus={onFocus} onBlur={onBlur} />
                      <Err msg={form3.formState.errors.children?.[index]?.firstName?.message} />
                    </div>
                    <div>
                      <input {...form3.register(`children.${index}.lastName`)} placeholder="Last Name"
                        style={iS} onFocus={onFocus} onBlur={onBlur} />
                      <Err msg={form3.formState.errors.children?.[index]?.lastName?.message} />
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold mb-1.5 uppercase tracking-wider text-gray-500">Date of Birth</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <select {...form3.register(`children.${index}.dobDay`)}
                          style={iS} onFocus={onFocus} onBlur={onBlur}>
                          <option value="">Day</option>
                          {DAYS.map(d => <option key={d} value={String(d)}>{d}</option>)}
                        </select>
                        <Err msg={form3.formState.errors.children?.[index]?.dobDay?.message} />
                      </div>
                      <div>
                        <select {...form3.register(`children.${index}.dobMonth`)}
                          style={iS} onFocus={onFocus} onBlur={onBlur}>
                          <option value="">Month</option>
                          {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
                        </select>
                        <Err msg={form3.formState.errors.children?.[index]?.dobMonth?.message} />
                      </div>
                      <div>
                        <select {...form3.register(`children.${index}.dobYear`)}
                          style={iS} onFocus={onFocus} onBlur={onBlur}>
                          <option value="">Year</option>
                          {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                        <Err msg={form3.formState.errors.children?.[index]?.dobYear?.message} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold mb-1.5 uppercase tracking-wider text-gray-500">Gender</p>
                    <div className="grid grid-cols-2 gap-2">
                      {["male", "female"].map(g => (
                        <label key={g}
                          className="flex items-center justify-center p-2.5 rounded-xl cursor-pointer text-sm font-semibold capitalize transition-all"
                          style={form3.watch(`children.${index}.gender`) === g
                            ? { background: NAVY, color: "#fff", boxShadow: "0 2px 6px rgba(26,35,126,0.2)" }
                            : { background: "rgba(26,35,126,0.04)", color: "#374151", border: "1px solid rgba(26,35,126,0.12)" }}>
                          <input type="radio" {...form3.register(`children.${index}.gender`)} value={g} className="sr-only" />
                          {g}
                        </label>
                      ))}
                    </div>
                    <Err msg={form3.formState.errors.children?.[index]?.gender?.message} />
                  </div>

                  <div>
                    <input {...form3.register(`children.${index}.allergies`)} placeholder="Known allergies (optional)"
                      style={iS} onFocus={onFocus} onBlur={onBlur} />
                  </div>
                </div>
              ))}
            </div>

            {typeof form3.formState.errors.children?.message === "string" && (
              <Err msg={form3.formState.errors.children.message} />
            )}

            <button type="button"
              onClick={() => append({ firstName: "", lastName: "", dobDay: "", dobMonth: "", dobYear: "", gender: "male", allergies: "" })}
              className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ border: `1.5px dashed rgba(26,35,126,0.25)`, color: NAVY, background: "rgba(26,35,126,0.03)" }}>
              <Plus className="w-4 h-4" /> Add Another Child
            </button>

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all"
                style={{ background: "rgba(26,35,126,0.07)", color: NAVY, border: "1px solid rgba(26,35,126,0.15)" }}>
                Back
              </button>
              <button type="submit" disabled={busy}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm text-white transition-all disabled:opacity-60"
                style={{ background: NAVY, boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}>
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                  : <><Check className="w-4 h-4" /> Create Family</>}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Families() {
  const [search, setSearch]   = useState("");
  const [isOpen, setIsOpen]   = useState(false);
  const [, setLocation]       = useLocation();

  const { data, isLoading, refetch } = useListFamilies({ search });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Families</h1>
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
          data-testid="button-create-family"
        >
          <Plus className="w-4 h-4" /> Add Family
        </button>
      </div>

      <AddFamilyWizard
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onCreated={(id) => { refetch(); setLocation(`/families/${id}`); }}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search families by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus-visible:ring-[#1a237e] shadow-sm"
          data-testid="input-search-families"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </>
        ) : data?.data?.map((family) => (
          <div
            key={family.id}
            className="bg-white rounded-2xl p-5 transition-all duration-300 border border-gray-100"
            style={{ boxShadow: "0 4px 6px -1px rgba(30,58,138,.05), 0 2px 4px -2px rgba(30,58,138,.05)" }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 10px 15px -3px rgba(30,58,138,.1), 0 4px 6px -2px rgba(30,58,138,.05)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 6px -1px rgba(30,58,138,.05), 0 2px 4px -2px rgba(30,58,138,.05)";
              (e.currentTarget as HTMLElement).style.transform = "";
            }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800 font-bold">
                  {family.parent1?.firstName?.[0]}{family.parent1?.lastName?.[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                    {family.parent1?.firstName} {family.parent1?.lastName}
                  </h3>
                  {family.parent2 && (
                    <p className="text-sm text-gray-500">
                      & {family.parent2.firstName} {family.parent2.lastName}
                    </p>
                  )}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                {family.familyCode}
              </span>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-blue-800" />
                <span className="font-medium">{family.children?.length || 0}</span> Children
              </div>
              <Link
                href={`/families/${family.id}`}
                className="text-sm font-semibold text-[#1a237e] hover:text-[#283593] flex items-center gap-1 transition-colors"
                data-testid={`link-family-${family.id}`}
              >
                <Eye className="w-4 h-4" /> View Profile
              </Link>
            </div>
          </div>
        ))}
        {data?.data?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No families found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
