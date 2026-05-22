import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, ShieldCheck, Check, Copy, AlertCircle, Baby, Users2, CheckCircle, Printer } from "lucide-react";

type SlotChoice = "7am" | "10:30am" | "both";

const SLOT_OPTIONS: { value: SlotChoice; label: string }[] = [
  { value: "7am",     label: "1st Service" },
  { value: "10:30am", label: "2nd Service" },
  { value: "both",    label: "Both Services" },
];

async function apiCall(url: string, method: string, body?: object) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

function SlotPicker({ value, onChange }: { value: SlotChoice; onChange: (v: SlotChoice) => void }) {
  return (
    <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "#f3f4f6" }}>
      {SLOT_OPTIONS.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className="flex-1 py-1.5 rounded-md text-xs font-bold transition-all"
          style={value === opt.value ? { background: "#1e3a8a", color: "white" } : { color: "#6b7280" }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type Path = "choose" | "find" | "walkin";

export default function FamilyAssist() {
  const { toast } = useToast();
  const [path, setPath] = useState<Path>("choose");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<any>(null);
  const [childSlots, setChildSlots] = useState<Record<number, SlotChoice>>({});
  const [checkedIn, setCheckedIn] = useState<Set<number>>(new Set());
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  const [delegateFor, setDelegateFor] = useState<any>(null);
  const [delegateName, setDelegateName] = useState("");
  const [delegatePhone, setDelegatePhone] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [generatingDelegate, setGeneratingDelegate] = useState(false);

  const [walkInForm, setWalkInForm] = useState({
    parentName: "", parentPhone: "", childFirstName: "", childLastName: "",
    dob: "", gender: "male" as "male" | "female", serviceSlot: "7am" as SlotChoice,
  });
  const [guestResult, setGuestResult] = useState<any>(null);
  const [submittingGuest, setSubmittingGuest] = useState(false);

  const resetFind = () => {
    setSearchQuery(""); setSearchResults([]); setSelectedFamily(null);
    setDelegateFor(null); setGeneratedOtp(null); setCheckedIn(new Set()); setChildSlots({});
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiCall(`/api/family-assist/search?q=${encodeURIComponent(searchQuery)}`, "GET");
      setSearchResults(data);
      if (data.length === 0) toast({ title: "No families found", description: "Try a different name or phone number" });
    } catch {
      toast({ variant: "destructive", title: "Search failed" });
    } finally {
      setSearching(false);
    }
  };

  const handleCheckIn = async (child: any) => {
    const slot = childSlots[child.id] ?? "7am";
    setCheckingIn(child.id);
    try {
      await apiCall("/api/family-assist/checkin", "POST", { childId: child.id, serviceSlot: slot });
      setCheckedIn(prev => new Set([...prev, child.id]));
      const label = slot === "both" ? "both services" : slot === "7am" ? "1st service" : "2nd service";
      toast({ title: "Checked In", description: `${child.firstName} checked in for ${label}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Check-in failed" });
    } finally {
      setCheckingIn(null);
    }
  };

  const handleGenerateDelegate = async () => {
    if (!delegateFor || !delegateName.trim() || !delegatePhone.trim()) return;
    setGeneratingDelegate(true);
    try {
      const res = await apiCall("/api/family-assist/delegate", "POST", {
        childId: delegateFor.id,
        delegateName: delegateName.trim(),
        delegatePhone: delegatePhone.trim(),
      });
      setGeneratedOtp(res.otpCode);
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Failed to generate OTP" });
    } finally {
      setGeneratingDelegate(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingGuest(true);
    try {
      const res = await apiCall("/api/family-assist/guest", "POST", walkInForm);
      setGuestResult(res);
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Guest check-in failed" });
    } finally {
      setSubmittingGuest(false);
    }
  };

  const printGuestBadge = (result: any) => {
    const win = window.open("", "_blank", "width=400,height=300");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Guest Badge</title>
<style>
  @media print { @page { margin: 0; size: 100mm 70mm; } body { margin: 8mm; } }
  body { font-family: Inter, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: white; text-align: center; }
  .guest { font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
  .name { font-size: 28px; font-weight: 900; color: #1e3a8a; margin-bottom: 6px; }
  .class { font-size: 16px; color: #374151; margin-bottom: 8px; font-weight: 600; }
  .code { font-size: 22px; color: #1e3a8a; font-family: monospace; font-weight: 700; background: #f3f4f6; padding: 6px 16px; border-radius: 8px; letter-spacing: 0.15em; }
  .label { font-size: 10px; color: #9ca3af; margin-top: 4px; }
  .date { font-size: 11px; color: #9ca3af; margin-top: 8px; }
  .logo { font-size: 11px; font-weight: 700; color: #1e3a8a; letter-spacing: 0.05em; border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 10px; width: 100%; }
</style></head><body>
<div class="guest">Walk-in Guest</div>
<div class="name">${result.child.firstName} ${result.child.lastName}</div>
<div class="class">${result.child.currentClass?.name ?? "Children's Church"}</div>
<div class="code">${result.guestCode}</div>
<div class="label">Checkout code — keep this safe</div>
<div class="date">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
<div class="logo">RCCG City of David · Shepherd Connect</div>
</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (path === "choose") {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <Users2 className="w-12 h-12 text-blue-800 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900">Family Assist</h2>
          <p className="text-sm text-gray-500 mt-1">Help parents without smartphones check in or add delegates</p>
        </div>
        <button onClick={() => setPath("find")}
          className="w-full p-5 rounded-2xl border-2 border-blue-100 bg-blue-50 text-left hover:border-blue-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Find Existing Family</p>
              <p className="text-sm text-gray-500">Search by parent name or phone number</p>
            </div>
          </div>
        </button>
        <button onClick={() => setPath("walkin")}
          className="w-full p-5 rounded-2xl border-2 border-amber-100 bg-amber-50 text-left hover:border-amber-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b" }}>
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Walk-in / Guest</p>
              <p className="text-sm text-gray-500">First-time or visiting parent — no account needed</p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  if (path === "find") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => { setPath("choose"); resetFind(); }}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium px-2 py-1 rounded hover:bg-gray-100">← Back</button>
          <h2 className="font-bold text-gray-900">Find Family</h2>
        </div>

        <div className="flex gap-2">
          <Input placeholder="Parent name or phone number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="rounded-xl" />
          <button onClick={handleSearch} disabled={searching}
            className="px-4 rounded-xl text-white font-bold disabled:opacity-60 flex-shrink-0"
            style={{ background: "#1e3a8a" }}>
            {searching ? "…" : <Search className="w-4 h-4" />}
          </button>
        </div>

        {!selectedFamily && searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((fam: any) => (
              <button key={fam.id} onClick={() => setSelectedFamily(fam)}
                className="w-full p-4 rounded-xl border border-gray-200 bg-white text-left hover:border-blue-300 hover:bg-blue-50 transition-all">
                <p className="font-bold text-gray-900">{fam.parentName}</p>
                <p className="text-xs text-gray-500">{fam.parentPhone ?? "No phone"} · Code: {fam.familyCode}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {fam.children.length} child{fam.children.length !== 1 ? "ren" : ""}: {fam.children.map((c: any) => c.firstName).join(", ")}
                </p>
              </button>
            ))}
          </div>
        )}

        {selectedFamily && !delegateFor && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900">{selectedFamily.parentName}</p>
                <p className="text-xs text-gray-500">{selectedFamily.parentPhone ?? "No phone"}</p>
                <p className="text-xs font-mono text-blue-700 mt-1">{selectedFamily.familyCode}</p>
              </div>
              <button onClick={() => setSelectedFamily(null)} className="text-gray-400 hover:text-gray-600 text-sm px-2">✕</button>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Children</p>
            {selectedFamily.children.map((child: any) => {
              const slot = childSlots[child.id] ?? "7am";
              const done = checkedIn.has(child.id);
              return (
                <div key={child.id} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{child.firstName} {child.lastName}</p>
                      <p className="text-xs text-gray-500">{child.currentClass?.name ?? "No class assigned"}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
                      {child.firstName[0]}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Service</p>
                    <SlotPicker value={slot} onChange={v => setChildSlots(p => ({ ...p, [child.id]: v }))} />
                  </div>

                  <div className="flex gap-2">
                    {done ? (
                      <div className="flex-1 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center gap-2 text-sm font-bold">
                        <CheckCircle className="w-4 h-4" /> Checked In
                      </div>
                    ) : (
                      <button onClick={() => handleCheckIn(child)}
                        disabled={!child.currentClass || checkingIn === child.id}
                        className="flex-1 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-all"
                        style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                        {checkingIn === child.id ? "Checking in…" : "Check In"}
                      </button>
                    )}
                    <button onClick={() => { setDelegateFor(child); setDelegateName(""); setDelegatePhone(""); setGeneratedOtp(null); }}
                      className="flex-1 h-10 rounded-xl text-sm font-bold border-2 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all">
                      + Delegate OTP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {delegateFor && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setDelegateFor(null); setGeneratedOtp(null); }}
                className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 rounded hover:bg-gray-100">← Back</button>
              <p className="font-bold text-gray-900">Delegate OTP for <span className="text-blue-800">{delegateFor.firstName}</span></p>
            </div>

            {!generatedOtp ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Delegate's Full Name</label>
                  <Input value={delegateName} onChange={e => setDelegateName(e.target.value)} placeholder="e.g. Uncle Peter Obi" className="rounded-xl" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Delegate's Phone Number</label>
                  <Input value={delegatePhone} onChange={e => setDelegatePhone(e.target.value)} placeholder="+234…" className="rounded-xl" />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex gap-2">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>A 6-digit OTP will be generated and sent by SMS to the delegate's phone.</span>
                </div>
                <button onClick={handleGenerateDelegate}
                  disabled={!delegateName.trim() || !delegatePhone.trim() || generatingDelegate}
                  className="w-full h-11 rounded-xl text-white font-bold disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                  {generatingDelegate ? "Generating…" : "Generate OTP & Send SMS"}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "#dcfce7" }}>
                  <ShieldCheck className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-bold text-gray-900">OTP Generated!</p>
                <div className="bg-gray-50 rounded-2xl p-5 border-2 border-dashed border-gray-200 relative">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">OTP Code</p>
                  <p className="text-5xl font-mono font-bold tracking-widest text-[#1e3a8a]">{generatedOtp}</p>
                  <p className="text-xs text-gray-400 mt-2">Valid for 24 hours · SMS sent to delegate</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(generatedOtp!); setCopiedOtp(true); setTimeout(() => setCopiedOtp(false), 2000); }}
                    className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-200 transition-colors">
                    {copiedOtp ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2 text-left">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Write this code on the child's name tag or hand it directly to the parent.</span>
                </div>
                <button onClick={() => { setDelegateFor(null); setGeneratedOtp(null); }}
                  className="w-full h-10 rounded-xl font-bold border border-gray-200 text-gray-700 hover:bg-gray-50">Done</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (path === "walkin") {
    if (guestResult) {
      return (
        <div className="space-y-5">
          <div className="text-center space-y-4 py-2">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "#dcfce7" }}>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Guest Checked In!</p>
              <p className="text-sm text-gray-500 mt-1">{guestResult.child.firstName} has been registered and checked in.</p>
            </div>

            <div className="rounded-2xl p-6 text-white" style={{ background: "#1e3a8a" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1 text-blue-300">Child's Name Tag Code</p>
              <p className="text-5xl font-mono font-bold tracking-widest">{guestResult.guestCode}</p>
              <p className="text-xs text-blue-300 mt-2">Write this on the name tag — needed at checkout</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-1.5 text-sm">
              <p><span className="text-gray-500">Child:</span> <strong>{guestResult.child.firstName} {guestResult.child.lastName}</strong></p>
              <p><span className="text-gray-500">Class:</span> <strong>{guestResult.child.currentClass?.name ?? "Children's Church"}</strong></p>
              <p><span className="text-gray-500">Parent:</span> <strong>{guestResult.parentName}</strong></p>
              {guestResult.parentPhone && <p><span className="text-gray-500">Phone:</span> <strong>{guestResult.parentPhone}</strong></p>}
            </div>

            <button onClick={() => printGuestBadge(guestResult)}
              className="w-full h-11 rounded-xl font-bold border-2 border-blue-800 text-blue-800 flex items-center justify-center gap-2 hover:bg-blue-50 transition-all">
              <Printer className="w-4 h-4" /> Print Name Tag
            </button>
            <button
              onClick={() => {
                setGuestResult(null);
                setPath("choose");
                setWalkInForm({ parentName: "", parentPhone: "", childFirstName: "", childLastName: "", dob: "", gender: "male", serviceSlot: "7am" });
              }}
              className="w-full h-11 rounded-xl font-bold text-white hover:opacity-90 transition-all"
              style={{ background: "#1e3a8a" }}>
              Done / Next Guest
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setPath("choose")}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium px-2 py-1 rounded hover:bg-gray-100">← Back</button>
          <div>
            <h2 className="font-bold text-gray-900">Walk-in / Guest Check-in</h2>
            <p className="text-xs text-gray-500">No account needed</p>
          </div>
        </div>

        <form onSubmit={handleGuestSubmit} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <Baby className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Guest records are automatically cleared every Sunday at 3 PM.</span>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Parent / Guardian</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Full Name *</label>
            <Input value={walkInForm.parentName} onChange={e => setWalkInForm(p => ({ ...p, parentName: e.target.value }))}
              placeholder="e.g. Mrs. Ngozi Okafor" className="rounded-xl" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Phone (optional)</label>
            <Input value={walkInForm.parentPhone} onChange={e => setWalkInForm(p => ({ ...p, parentPhone: e.target.value }))}
              placeholder="+234…" className="rounded-xl" />
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 pt-2">Child</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First Name *</label>
              <Input value={walkInForm.childFirstName} onChange={e => setWalkInForm(p => ({ ...p, childFirstName: e.target.value }))}
                placeholder="First name" className="rounded-xl" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last Name *</label>
              <Input value={walkInForm.childLastName} onChange={e => setWalkInForm(p => ({ ...p, childLastName: e.target.value }))}
                placeholder="Last name" className="rounded-xl" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Date of Birth *</label>
              <Input type="date" value={walkInForm.dob} onChange={e => setWalkInForm(p => ({ ...p, dob: e.target.value }))}
                className="rounded-xl" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Gender *</label>
              <select value={walkInForm.gender} onChange={e => setWalkInForm(p => ({ ...p, gender: e.target.value as "male" | "female" }))}
                className="w-full h-10 rounded-xl border border-input px-3 text-sm bg-white">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Service</p>
            <SlotPicker value={walkInForm.serviceSlot} onChange={v => setWalkInForm(p => ({ ...p, serviceSlot: v }))} />
          </div>

          <button type="submit" disabled={submittingGuest}
            className="w-full h-12 rounded-xl text-white font-bold disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            {submittingGuest ? "Registering…" : "Register & Check In Guest"}
          </button>
        </form>
      </div>
    );
  }

  return null;
}
