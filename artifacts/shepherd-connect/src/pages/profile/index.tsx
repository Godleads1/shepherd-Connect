import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Phone, Briefcase, Bell, Camera, Save, CheckCircle, MessageSquare, Smartphone } from "lucide-react";

interface CommPrefs {
  inApp: boolean;
  whatsapp: boolean;
  sms: boolean;
  email: boolean;
}

export default function Profile() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["profile", authUser?.id],
    queryFn: () => apiGet<any>(`/users/${authUser?.id}`),
    enabled: !!authUser?.id,
  });

  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "",
    dob: "", gender: "", placeOfWork: "", photoUrl: "",
  });
  const [prefs, setPrefs] = useState<CommPrefs>({ inApp: true, whatsapp: false, sms: false, email: false });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        phone: profile.phone || "",
        dob: profile.dob || "",
        gender: profile.gender || "",
        placeOfWork: profile.placeOfWork || "",
        photoUrl: profile.photoUrl || "",
      });
      if (profile.communicationPrefs) {
        try { setPrefs(JSON.parse(profile.communicationPrefs)); } catch {}
      }
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiPut(`/users/${authUser!.id}`, data),
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      setEditing(false);
      refetch();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      communicationPrefs: JSON.stringify(prefs),
    });
  };

  const completeness = (() => {
    const fields = [form.firstName, form.lastName, form.phone, form.dob, form.gender, form.placeOfWork];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  })();

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            {form.photoUrl ? (
              <img src={form.photoUrl} alt="Profile" className="w-20 h-20 rounded-2xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                {profile?.firstName?.[0]}{profile?.lastName?.[0]}
              </div>
            )}
            {editing && (
              <button className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center shadow-md">
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              {profile?.firstName} {profile?.lastName}
            </h1>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="capitalize" style={{ background: "#1e3a8a", color: "white" }}>
                {profile?.role?.replace("_", " ")}
              </Badge>
              {profile?.status === "active" && <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>}
            </div>

            {/* Profile completeness */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Profile completeness</span>
                <span className="font-semibold text-[#1e3a8a]">{completeness}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${completeness}%`, background: completeness >= 80 ? "#16a34a" : completeness >= 50 ? "#f59e0b" : "#dc2626" }} />
              </div>
              {completeness < 100 && <p className="text-xs text-gray-400 mt-1">Complete your profile for the best experience</p>}
            </div>
          </div>
          <Button variant={editing ? "outline" : "default"} size="sm" onClick={() => setEditing(e => !e)}
            style={editing ? {} : { background: "#1e3a8a" }}>
            {editing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-[#1e3a8a]" /> Personal Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">First Name</label>
            {editing ? <Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
              : <p className="text-gray-900 font-medium">{form.firstName || "—"}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Last Name</label>
            {editing ? <Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
              : <p className="text-gray-900 font-medium">{form.lastName || "—"}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Date of Birth</label>
            {editing ? <Input type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} />
              : <p className="text-gray-900">{form.dob ? new Date(form.dob).toLocaleDateString() : "—"}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Gender</label>
            {editing ? (
              <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            ) : <p className="text-gray-900 capitalize">{form.gender || "—"}</p>}
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Phone Number
            </label>
            {editing ? <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+234..." />
              : <p className="text-gray-900">{form.phone || "—"}</p>}
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> Place of Work
            </label>
            {editing ? <Input value={form.placeOfWork} onChange={e => setForm(p => ({ ...p, placeOfWork: e.target.value }))} placeholder="Company or organisation" />
              : <p className="text-gray-900">{form.placeOfWork || "—"}</p>}
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">Profile Photo URL</label>
            {editing ? <Input value={form.photoUrl} onChange={e => setForm(p => ({ ...p, photoUrl: e.target.value }))} placeholder="https://..." />
              : <p className="text-gray-900 text-sm truncate">{form.photoUrl || "—"}</p>}
          </div>
        </div>
      </div>

      {/* Communication Preferences */}
      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#1e3a8a]" /> Communication Preferences
        </h2>
        <p className="text-xs text-gray-500 mb-4">Choose how you'd like to receive notifications from Shepherd Connect</p>
        <div className="space-y-3">
          {[
            { key: "inApp", label: "In-App Notifications", icon: Bell, desc: "Alerts within the Shepherd Connect app" },
            { key: "whatsapp", label: "WhatsApp Messages", icon: MessageSquare, desc: "Notifications via WhatsApp (coming soon)" },
            { key: "sms", label: "SMS Text Messages", icon: Smartphone, desc: "Text message alerts (coming soon)" },
          ].map(({ key, label, icon: Icon, desc }) => (
            <div key={key} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs[key as keyof CommPrefs] ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
              onClick={() => editing && setPrefs(p => ({ ...p, [key]: !p[key as keyof CommPrefs] }))}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${prefs[key as keyof CommPrefs] ? "bg-[#1e3a8a]" : "bg-gray-200"}`}>
                  <Icon className={`w-4 h-4 ${prefs[key as keyof CommPrefs] ? "text-white" : "text-gray-400"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${prefs[key as keyof CommPrefs] ? "border-[#1e3a8a] bg-[#1e3a8a]" : "border-gray-300"}`}>
                {prefs[key as keyof CommPrefs] && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
            </div>
          ))}
        </div>
        {!editing && <p className="text-xs text-gray-400 text-center mt-3">Click "Edit Profile" to change your preferences</p>}
      </div>

      {editing && (
        <Button className="w-full flex items-center gap-2 py-6 text-base" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}
          onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="w-5 h-5" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      )}
    </div>
  );
}
