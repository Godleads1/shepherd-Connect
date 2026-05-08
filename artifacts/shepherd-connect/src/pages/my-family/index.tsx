import { useState } from "react";
import { useGetMyFamily, useListClasses, useCreateChild } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { QrCode, FileText, Users, MapPin, ShieldCheck, Star, PlusCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth";

function ChildCard({ child }: { child: any }) {
  const statusColor = child.currentClass ? "#16a34a" : "#1a237e";
  const statusBg = child.currentClass ? "#dcfce7" : "#eff6ff";
  const statusText = child.currentClass ? "In Class" : "Unassigned";
  const borderColor = child.currentClass ? "#16a34a" : "#1a237e";
  const hasAllergy = !!child.allergies;

  return (
    <div
      className="bg-white rounded-2xl p-5 transition-all duration-300 border-l-4"
      style={{
        boxShadow: "0 4px 6px -1px rgba(30,58,138,.10), 0 2px 4px -2px rgba(30,58,138,.10)",
        borderLeftColor: borderColor,
      }}
    >
      {hasAllergy && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" /> Allergy: {child.allergies}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          {child.photoUrl ? (
            <img src={child.photoUrl} alt={child.firstName} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-sm"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
              {child.firstName[0]}{child.lastName[0]}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
            style={{ background: statusColor }}>
            <span className="text-white text-[8px]">{child.currentClass ? "✓" : "?"}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 text-base leading-tight">{child.firstName} {child.lastName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">Age {child.age}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ background: statusBg, color: statusColor }}>
              {statusText}
            </span>
          </div>

          {child.currentClass && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#1e3a8a] flex-shrink-0" />
              <span className="font-medium">{child.currentClass.name}</span>
              <span className="text-gray-300">·</span>
              <span>{child.currentClass.roomLocation}</span>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Link href={`/children/${child.id}`} className="flex-1">
              <button className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                style={{ background: "#1e3a8a", color: "white" }}>
                <QrCode className="w-3.5 h-3.5" /> Show QR
              </button>
            </Link>
            <Link href={`/class-change-requests`} className="flex-1">
              <button className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all hover:bg-blue-50"
                style={{ background: "#f8faff", borderColor: "#1a237e", color: "#1a237e" }}>
                <FileText className="w-3.5 h-3.5" /> Class Change
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
  const { data: family, isLoading, refetch } = useGetMyFamily();
  const { data: classesData } = useListClasses({});
  const createChildMutation = useCreateChild();
  const { toast } = useToast();

  const [addChildOpen, setAddChildOpen] = useState(false);
  const [childForm, setChildForm] = useState({
    firstName: "", lastName: "", dob: "", gender: "male" as "male" | "female",
    allergies: "", medicalNotes: "", currentClassId: "",
  });

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
          currentClassId: childForm.currentClassId ? Number(childForm.currentClassId) : null,
        } as any,
      });
      toast({ title: "Child added successfully!" });
      setAddChildOpen(false);
      setChildForm({ firstName: "", lastName: "", dob: "", gender: "male", allergies: "", medicalNotes: "", currentClassId: "" });
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Failed to add child" });
    }
  };

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

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { href: "/pickup-delegates", label: "Delegates", icon: ShieldCheck, color: "#1e3a8a" },
          { href: "/feedback", label: "Feedback", icon: Star, color: "#1a237e" },
          { href: "/class-change-requests", label: "Class Change", icon: FileText, color: "#16a34a" },
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
          {family?.id && (
            <Button size="sm" onClick={() => setAddChildOpen(true)} className="flex items-center gap-1.5 text-xs"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
              <PlusCircle className="w-3.5 h-3.5" /> Add Child
            </Button>
          )}
        </div>
        {children.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">No children registered yet.</p>
            {family?.id && (
              <Button size="sm" onClick={() => setAddChildOpen(true)} style={{ background: "#1e3a8a" }} className="text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> Register Your First Child
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {children.map((child: any) => <ChildCard key={child.id} child={child} />)}
          </div>
        )}
      </div>

      {/* Add Child Modal */}
      <Dialog open={addChildOpen} onOpenChange={setAddChildOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Register a New Child</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Class (optional)</label>
              <Select value={childForm.currentClassId} onValueChange={v => setChildForm(p => ({ ...p, currentClassId: v }))}>
                <SelectTrigger><SelectValue placeholder="Auto-suggest by age" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {(classesData || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name} (Age {c.ageMin}–{c.ageMax})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Allergies</label>
              <Input value={childForm.allergies} onChange={e => setChildForm(p => ({ ...p, allergies: e.target.value }))} placeholder="e.g. Peanuts, Dairy" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Medical Notes</label>
              <Input value={childForm.medicalNotes} onChange={e => setChildForm(p => ({ ...p, medicalNotes: e.target.value }))} placeholder="Any medical conditions or special needs" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setAddChildOpen(false)}>Cancel</Button>
              <Button onClick={handleAddChild} disabled={createChildMutation.isPending} style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                {createChildMutation.isPending ? "Registering..." : "Register Child"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
