import { useState, useRef, useEffect } from "react";
import { useGetMyFamily, useCreateChild, useUpdateChild } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Users, MapPin, ShieldCheck, Star, PlusCircle, AlertCircle, Download, X, Camera, Loader2, Cake, ChevronDown, ChevronUp, Calendar, CheckCircle, BellRing } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { QRCodeSVG } from "qrcode.react";
import { apiGet, apiPost } from "@/lib/api-call";
import { PhotoUploader, resolvePhotoUrl } from "@/components/PhotoUploader";
import WelcomeModal, { shouldShowWelcome } from "@/components/WelcomeModal";

function isBirthdayToday(dob: string): boolean {
  const d = new Date(dob);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function isBirthdayThisMonth(dob: string): boolean {
  return new Date(dob).getMonth() === new Date().getMonth();
}
function daysUntilBirthday(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  const next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - now.getTime()) / 86400000);
}

function AttendanceHistory({ children }: { children: any[] }) {
  const [open, setOpen] = useState(false);
  const [activeChild, setActiveChild] = useState<number | null>(null);

  const childId = activeChild ?? children[0]?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["parent-attendance", childId],
    queryFn: () => apiGet<any>(`/attendance?childId=${childId}&limit=20`),
    enabled: open && !!childId,
  });

  const records: any[] = data?.data ?? [];

  const statusLabel: Record<string, { label: string; color: string }> = {
    dropped_off:  { label: "Dropped Off",   color: "#f59e0b" },
    in_transit:   { label: "In Transit",    color: "#3b82f6" },
    in_class:     { label: "In Class",      color: "#8b5cf6" },
    picked_up:    { label: "Picked Up ✓",   color: "#16a34a" },
  };

  return (
    <div className="bg-white rounded-2xl border" style={{ boxShadow: "0 2px 8px rgba(30,58,138,.06)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4.5 h-4.5 text-[#1e3a8a]" />
          <span className="font-semibold text-gray-900">Attendance History</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t px-5 pb-5 pt-4 space-y-4">
          {/* Child selector tabs */}
          {children.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {children.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setActiveChild(c.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={childId === c.id
                    ? { background: "#1e3a8a", color: "white" }
                    : { background: "#f1f5f9", color: "#64748b" }}
                >
                  {c.firstName}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          )}

          {!isLoading && records.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No attendance records yet</p>
            </div>
          )}

          {!isLoading && records.length > 0 && (
            <div className="space-y-2">
              {records.map((r: any) => {
                const st = statusLabel[r.status] ?? { label: r.status, color: "#6b7280" };
                return (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(r.serviceDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{r.serviceSlot === "7am" ? "7:00 AM" : "10:30 AM"} service</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: st.color + "20", color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function FamilyQRModal({ family, open, onClose }: { family: any; open: boolean; onClose: () => void }) {
  const qrValue = `QR:${family?.id}`;
  const handleDownload = () => {
    const svg = document.getElementById("family-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 440;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 440);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 50, 300, 300);
      ctx.fillStyle = "#1e3a8a";
      ctx.font = "bold 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(family.familyCode, 200, 390);
      ctx.font = "14px Inter, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Shepherd Connect · Scan to Check In", 200, 415);
      const a = document.createElement("a");
      a.download = `${family.familyCode}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#1e3a8a]" /> Family Check-In QR
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="p-5 bg-white rounded-2xl border-2 border-[#1e3a8a]/10 shadow-inner">
            <QRCodeSVG
              id="family-qr-svg"
              value={qrValue}
              size={240}
              level="H"
              includeMargin
              imageSettings={{
                src: "/rccg-logo-new.png",
                x: undefined,
                y: undefined,
                height: 40,
                width: 40,
                excavate: true,
              }}
            />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold font-mono tracking-widest" style={{ color: "#1e3a8a" }}>
              {family?.familyCode}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Show this at the check-in desk to drop off all your children at once
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <Button
              onClick={handleDownload}
              className="flex-1 gap-2"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
            >
              <Download className="w-4 h-4" /> Save QR Code
            </Button>
            <Button variant="outline" onClick={onClose} className="px-4">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChildCard({ child, onRefetch }: { child: any; onRefetch: () => void }) {
  const borderColor = child.currentClass ? "#16a34a" : "#1a237e";
  const hasAllergy = !!child.allergies;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [pickupSent, setPickupSent] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const updateChild = useUpdateChild();

  // Check if child is currently checked in (today, not yet picked up)
  const today = new Date().toISOString().split("T")[0];
  const { data: attData } = useQuery({
    queryKey: ["child-today-attendance", child.id, today],
    queryFn: () => apiGet<any>(`/attendance?childId=${child.id}&serviceDate=${today}`),
    refetchInterval: 60000,
  });
  const todayRecords: any[] = attData ?? [];
  const isCheckedIn = todayRecords.some((r: any) => r.status !== "picked_up");

  const handleImHere = async () => {
    setPickupLoading(true);
    try {
      await apiPost("/pickup-requests", { childId: child.id });
      setPickupSent(true);
      toast({ title: `Signal sent! 🚶 The teacher has been notified to bring ${child.firstName}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Could not send pickup signal" });
    } finally {
      setPickupLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const preview = URL.createObjectURL(file);
    setLocalPhoto(preview);
    try {
      const token = localStorage.getItem("token");
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
      });
      if (!metaRes.ok) throw new Error("Could not get upload URL");
      const { uploadURL, objectPath } = await metaRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
      if (!putRes.ok) throw new Error("Upload failed");
      await updateChild.mutateAsync({ id: child.id, data: { ...child, photoUrl: objectPath } as any });
      toast({ title: `${child.firstName}'s photo updated!` });
      onRefetch();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Photo upload failed" });
      setLocalPhoto(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const displayPhoto = localPhoto ?? resolvePhotoUrl(child.photoUrl);

  return (
    <div
      className="bg-white rounded-2xl p-5 transition-all duration-300 border-l-4"
      style={{
        boxShadow: "0 4px 6px -1px rgba(30,58,138,.10), 0 2px 4px -2px rgba(30,58,138,.10)",
        borderLeftColor: borderColor,
      }}
    >
      {child.dob && isBirthdayToday(child.dob) && (
        <div className="mb-3 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 animate-pulse"
          style={{ background: "linear-gradient(135deg, #f59e0b22, #fbbf2422)", color: "#d97706", border: "1px solid #fbbf24" }}>
          <Cake className="w-4 h-4" /> 🎉 Happy Birthday, {child.firstName}! Today is their special day!
        </div>
      )}
      {child.dob && !isBirthdayToday(child.dob) && isBirthdayThisMonth(child.dob) && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold flex items-center gap-2">
          <Cake className="w-3.5 h-3.5" /> Birthday this month — {daysUntilBirthday(child.dob) === 0 ? "today!" : `in ${daysUntilBirthday(child.dob)} day${daysUntilBirthday(child.dob) === 1 ? "" : "s"}`}
        </div>
      )}
      {hasAllergy && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> Allergy: {child.allergies}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-sm focus:outline-none active:scale-95 transition-transform"
            title="Tap to add or change photo"
          >
            {displayPhoto ? (
              <img src={displayPhoto} alt={child.firstName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-0.5"
                style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                <span className="text-xl font-bold text-white leading-none">{child.firstName[0]}{child.lastName[0]}</span>
                <Camera className="w-3 h-3 text-white/70" />
              </div>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          {/* Always-visible camera badge */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-sm"
            style={{ background: uploading ? "#f59e0b" : "#1e3a8a" }}>
            {uploading
              ? <Loader2 className="w-3 h-3 text-white animate-spin" />
              : <Camera className="w-3 h-3 text-white" />
            }
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{child.firstName} {child.lastName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">Age {child.age}</p>
            </div>
          </div>

          {child.currentClass && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#1e3a8a] flex-shrink-0" />
              <span className="font-medium">{child.currentClass.name}</span>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {/* I'm here to pick up — always visible; active only when child is checked in */}
            <button
              onClick={isCheckedIn ? handleImHere : undefined}
              disabled={!isCheckedIn || pickupLoading || pickupSent}
              title={!isCheckedIn ? `${child.firstName} is not checked in yet` : undefined}
              className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              style={
                pickupSent
                  ? { background: "#16a34a", color: "white" }
                  : isCheckedIn
                    ? { background: "#f59e0b", color: "#1a1a1a", cursor: "pointer" }
                    : { background: "#f1f5f9", color: "#94a3b8", cursor: "not-allowed", border: "1px solid #e2e8f0" }
              }
            >
              {pickupLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                : pickupSent
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Teacher notified!</>
                  : isCheckedIn
                    ? <><BellRing className="w-3.5 h-3.5" /> I'm here to pick up {child.firstName}</>
                    : <><BellRing className="w-3.5 h-3.5" /> I'm here to pick up {child.firstName}</>
              }
            </button>
            {!isCheckedIn && !pickupSent && (
              <p className="text-center text-[10px] text-gray-400 -mt-1">Available once {child.firstName} is checked in</p>
            )}
            <Link href={`/children/${child.id}`} className="flex-1">
              <button className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                style={{ background: "#1e3a8a", color: "white" }}>
                <QrCode className="w-3.5 h-3.5" /> View Profile
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyFamily() {
  const { user } = useAuth();
  const { data: family, isLoading, isError, refetch } = useGetMyFamily();
  const createChildMutation = useCreateChild();
  const { toast } = useToast();

  const [addChildOpen, setAddChildOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [childForm, setChildForm] = useState({
    firstName: "", lastName: "", dob: "", gender: "male" as "male" | "female",
    allergies: "", medicalNotes: "", photoUrl: "",
  });

  const detectedAge = (() => {
    if (!childForm.dob) return null;
    const today = new Date();
    const birth = new Date(childForm.dob);
    if (isNaN(birth.getTime())) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  })();
  const autoClass = detectedAge !== null && detectedAge >= 1 && detectedAge <= 12
    ? `Class ${detectedAge}`
    : detectedAge !== null
      ? `Age ${detectedAge} — no class available`
      : null;

  useEffect(() => {
    if (!isLoading && shouldShowWelcome(user?.role, false)) {
      setShowWelcome(true);
    }
  }, [isLoading, user?.role]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const handleAddChild = async () => {
    if (!childForm.firstName || !childForm.lastName || !childForm.dob) {
      toast({ variant: "destructive", title: "First name, last name, and date of birth are required" });
      return;
    }
    if (!family?.id) {
      toast({ variant: "destructive", title: "No family record found. Please contact an administrator." });
      return;
    }
    try {
      await createChildMutation.mutateAsync({
        data: {
          familyId: family.id,
          firstName: childForm.firstName,
          lastName: childForm.lastName,
          dob: childForm.dob,
          gender: childForm.gender,
          allergies: childForm.allergies || null,
          medicalNotes: childForm.medicalNotes || null,
          photoUrl: childForm.photoUrl || null,
        } as any,
      });
      toast({ title: "Child added successfully!" });
      setAddChildOpen(false);
      setChildForm({ firstName: "", lastName: "", dob: "", gender: "male", allergies: "", medicalNotes: "", photoUrl: "" });
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Failed to add child" });
    }
  };

  if (isError) return <QueryError message="Could not load your family." onRetry={() => refetch()} />;
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const children = family?.children || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -right-4 w-32 h-32 rounded-full bg-white/5" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm">{greeting},</p>
          <h1 className="text-2xl font-bold text-white mt-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-white/60 text-xs mt-1">Your family is covered by grace</p>
          <div className="flex items-center gap-3 mt-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.20)" }}>
              {children.length} {children.length === 1 ? "Child" : "Children"}
            </span>
            {family?.familyCode && (
              <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
                {family.familyCode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Family QR Card */}
      {family?.id && (
        <div
          className="bg-white rounded-2xl p-5 border cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
          style={{ borderColor: "#1e3a8a20", boxShadow: "0 2px 12px rgba(30,58,138,.08)" }}
          onClick={() => setQrModalOpen(true)}
        >
          <div className="flex items-center gap-5">
            <div className="p-3 rounded-xl" style={{ background: "#eff6ff" }}>
              <QRCodeSVG
                value={`QR:${family.id}`}
                size={72}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="w-4 h-4 text-[#1e3a8a]" />
                <p className="font-bold text-gray-900">Family Check-In QR</p>
              </div>
              <p className="text-sm text-gray-500">Show this at the kiosk to check in all your children at once</p>
              <p className="font-mono text-sm font-bold mt-2" style={{ color: "#1e3a8a" }}>{family.familyCode}</p>
            </div>
            <div className="text-[#1e3a8a] font-semibold text-xs flex flex-col items-center gap-1">
              <span className="text-xl">›</span>
              <span>Expand</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/pickup-delegates", label: "Delegates", icon: ShieldCheck, color: "#1e3a8a" },
          { href: "/feedback", label: "Feedback", icon: Star, color: "#1a237e" },
          { href: "/notifications", label: "Alerts", icon: Users, color: "#dc2626" },
        ].map(action => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <div className="rounded-xl p-3 text-center cursor-pointer transition-all hover:scale-105 bg-white"
                style={{ boxShadow: "0 2px 8px rgba(30,58,138,.08)" }}>
                <div className="w-9 h-9 rounded-full mx-auto mb-1.5 flex items-center justify-center"
                  style={{ background: action.color + "1a" }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: action.color }} />
                </div>
                <p className="text-[10px] font-semibold text-gray-700 leading-tight">{action.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Children */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            My Children
            <span className="text-sm font-normal text-gray-400">({children.length})</span>
          </h2>
        </div>
        {children.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">No children registered yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {children.map((child: any) => <ChildCard key={child.id} child={child} onRefetch={refetch} />)}
          </div>
        )}
        {family?.id && (
          <Button onClick={() => setAddChildOpen(true)} className="w-full mt-2 flex items-center justify-center gap-2 py-5"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
            <PlusCircle className="w-4 h-4" /> Add a Child
          </Button>
        )}
      </div>

      {/* Birthday celebration banner — shown when any child has a birthday this month */}
      {children.some((c: any) => c.dob && isBirthdayThisMonth(c.dob)) && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, #78350f22, #f59e0b18)", border: "1px solid #fbbf24" }}>
          <span className="text-3xl select-none">🎂</span>
          <div>
            <p className="font-bold text-amber-800 text-sm">Birthday{children.filter((c: any) => c.dob && isBirthdayThisMonth(c.dob)).length > 1 ? "s" : ""} this month!</p>
            <p className="text-xs text-amber-700">
              {children.filter((c: any) => c.dob && isBirthdayThisMonth(c.dob)).map((c: any) => c.firstName).join(" & ")} — don't forget to celebrate!
            </p>
          </div>
        </div>
      )}

      {/* Attendance History */}
      {children.length > 0 && <AttendanceHistory children={children} />}

      {/* Family QR Modal */}
      {family && <FamilyQRModal family={family} open={qrModalOpen} onClose={() => setQrModalOpen(false)} />}

      {/* Welcome Onboarding Modal — shown to first-time parents */}
      {showWelcome && (
        <WelcomeModal
          onClose={() => setShowWelcome(false)}
          onAddChild={() => { setShowWelcome(false); setAddChildOpen(true); }}
        />
      )}

      {/* Add Child Modal */}
      <Dialog open={addChildOpen} onOpenChange={setAddChildOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Register a New Child</DialogTitle></DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="flex justify-center">
              <PhotoUploader
                currentPhotoUrl={childForm.photoUrl}
                fallbackLabel={childForm.firstName ? childForm.firstName[0] : "?"}
                onChange={path => setChildForm(p => ({ ...p, photoUrl: path }))}
                size="lg"
                shape="rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">First Name *</label>
                <Input value={childForm.firstName} onChange={e => setChildForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Last Name *</label>
                <Input value={childForm.lastName} onChange={e => setChildForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Date of Birth *</label>
              <Input type="date" value={childForm.dob} onChange={e => setChildForm(p => ({ ...p, dob: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Gender *</label>
              <Select value={childForm.gender} onValueChange={v => setChildForm(p => ({ ...p, gender: v as "male" | "female" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {autoClass && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border"
                style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Auto-assigned: <span className="ml-1">{autoClass}</span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Allergies</label>
              <Input value={childForm.allergies} onChange={e => setChildForm(p => ({ ...p, allergies: e.target.value }))} placeholder="e.g. Peanuts, Dairy" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Medical Notes</label>
              <Input value={childForm.medicalNotes} onChange={e => setChildForm(p => ({ ...p, medicalNotes: e.target.value }))} placeholder="Any medical conditions or special needs" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t mt-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setAddChildOpen(false)}>Cancel</Button>
            <Button onClick={handleAddChild} disabled={createChildMutation.isPending} style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
              {createChildMutation.isPending ? "Registering..." : "Register Child"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
