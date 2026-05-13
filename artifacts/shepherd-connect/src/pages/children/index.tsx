import { useState } from "react";
import { useListChildren, useListFamilies, useCreateChild, useListClasses } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Eye, AlertCircle, Baby, MapPin, Trash2, Upload, FileSpreadsheet, CheckCircle, XCircle, Plus } from "lucide-react";
import { PhotoUploader } from "@/components/PhotoUploader";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";
import { apiDelete, apiPost } from "@/lib/api-call";

const CSV_TEMPLATE = `firstName,lastName,dateOfBirth,gender,allergies,medicalNotes
Emma,Smith,2018-04-12,female,,
Liam,Johnson,2017-09-03,male,peanuts,carries epipen`;

function BulkImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (rows: object[]) => apiPost<any>("/children/bulk-import", { rows }),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["children"] });
      toast({ title: `${data.created} children imported` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message || "Import failed" }),
  });

  const handleImport = () => {
    const lines = csv.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] || ""]));
    });
    importMutation.mutate(rows);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setResult(null); onClose(); } }}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-700" /> Bulk Import Children (CSV)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Paste or edit CSV below. Required: <code className="bg-gray-100 px-1 rounded">firstName, lastName, dateOfBirth</code>. Optional: gender, allergies, medicalNotes.
          </p>
          {!result ? (
            <>
              <textarea
                className="w-full text-sm font-mono border rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[180px] bg-gray-50"
                value={csv}
                onChange={e => setCsv(e.target.value)}
                spellCheck={false}
              />
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                  {importMutation.isPending ? "Importing..." : <><Upload className="w-4 h-4" /> Import Children</>}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600">Children imported</p>
                </div>
                <div className={`rounded-xl p-4 text-center border ${result.failed > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                  <XCircle className={`w-8 h-8 mx-auto mb-1 ${result.failed > 0 ? "text-red-400" : "text-gray-300"}`} />
                  <p className={`text-2xl font-bold ${result.failed > 0 ? "text-red-600" : "text-gray-400"}`}>{result.failed}</p>
                  <p className={`text-xs ${result.failed > 0 ? "text-red-500" : "text-gray-400"}`}>Rows skipped</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
                  {result.errors.slice(0, 5).map((e: string, i: number) => (
                    <p key={i} className="text-xs text-red-600">• {e}</p>
                  ))}
                </div>
              )}
              <button onClick={() => { setResult(null); setCsv(CSV_TEMPLATE); onClose(); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                Done
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddChildModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const createChild = useCreateChild();
  const { data: familiesData } = useListFamilies({ limit: 200 } as any, { query: { enabled: open, queryKey: ["families-for-child-add"] } });
  const { data: classesData } = useListClasses({}, { query: { enabled: open, queryKey: ["classes-for-child-add"] } });
  const families = familiesData?.data ?? [];
  const classes = (classesData as any[]) ?? [];

  const [form, setForm] = useState({
    familyId: "", firstName: "", lastName: "", dob: "",
    gender: "male" as "male" | "female", allergies: "", medicalNotes: "", currentClassId: "", photoUrl: "",
  });

  const reset = () => setForm({ familyId: "", firstName: "", lastName: "", dob: "", gender: "male", allergies: "", medicalNotes: "", currentClassId: "", photoUrl: "" });

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.familyId) { toast({ variant: "destructive", title: "Please select a family" }); return; }
    if (!form.firstName || !form.lastName || !form.dob) {
      toast({ variant: "destructive", title: "First name, last name and date of birth are required" }); return;
    }
    try {
      await createChild.mutateAsync({
        data: {
          familyId: Number(form.familyId),
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
          gender: form.gender,
          allergies: form.allergies || undefined,
          medicalNotes: form.medicalNotes || undefined,
          currentClassId: form.currentClassId ? Number(form.currentClassId) : undefined,
          photoUrl: form.photoUrl || undefined,
        } as any,
      });
      toast({ title: "Child registered successfully!" });
      handleClose();
      onCreated();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to add child", description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <Baby className="w-5 h-5" style={{ color: "#1e3a8a" }} /> Add New Child
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="flex justify-center">
            <PhotoUploader
              currentPhotoUrl={form.photoUrl}
              fallbackLabel={form.firstName ? form.firstName[0] : "?"}
              onChange={path => setForm(p => ({ ...p, photoUrl: path }))}
              size="lg"
              shape="rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Family <span className="text-red-500">*</span></label>
            <Select value={form.familyId} onValueChange={v => setForm(p => ({ ...p, familyId: v }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a family…" /></SelectTrigger>
              <SelectContent>
                {families.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.parent1?.firstName} {f.parent1?.lastName} — {f.familyCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First Name <span className="text-red-500">*</span></label>
              <Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last Name <span className="text-red-500">*</span></label>
              <Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
            <Input type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Gender <span className="text-red-500">*</span></label>
            <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v as "male" | "female" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Class <span className="text-gray-400 font-normal">(optional)</span></label>
            <Select value={form.currentClassId || "unassigned"} onValueChange={v => setForm(p => ({ ...p, currentClassId: v === "unassigned" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} (Age {c.ageMin}–{c.ageMax})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Allergies <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} placeholder="e.g. Peanuts, Dairy" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Medical Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input value={form.medicalNotes} onChange={e => setForm(p => ({ ...p, medicalNotes: e.target.value }))} placeholder="Any conditions or special needs" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={createChild.isPending}>Cancel</Button>
            <Button type="submit" disabled={createChild.isPending}
              style={{ background: "linear-gradient(135deg,#1e3a8a,#1d4ed8)", color: "white" }}>
              {createChild.isPending ? "Registering…" : "Register Child"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Children() {
  const [search, setSearch] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { data, isLoading, refetch } = useListChildren({ search, unassigned: unassignedOnly });
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canDelete = currentUser?.role === "super_admin" || currentUser?.role === "admin";

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/children/${id}`),
    onSuccess: () => {
      toast({ title: "Child deleted" });
      queryClient.invalidateQueries({ queryKey: ["children"] });
    },
    onError: () => toast({ variant: "destructive", title: "Delete failed" }),
  });

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AddChildModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["children"] }); }} />
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Children</h1>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Import CSV
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
              data-testid="button-create-child"
            >
              <Plus className="w-4 h-4" /> Add Child
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search children..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus-visible:ring-[#1a237e] shadow-sm"
            data-testid="input-search-children"
          />
        </div>
        <div className="flex items-center space-x-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
          <Switch 
            id="unassigned" 
            checked={unassignedOnly} 
            onCheckedChange={setUnassignedOnly}
            data-testid="switch-unassigned"
          />
          <label htmlFor="unassigned" className="text-sm font-medium text-gray-700 cursor-pointer">
            Unassigned Only
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </>
        ) : data?.data?.map((child) => (
          <div 
            key={child.id}
            className="bg-white rounded-2xl p-5 transition-all duration-300 border border-gray-100 flex flex-col h-full"
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
            {child.allergies && (
              <div className="mb-3 -mt-1 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1.5 w-fit uppercase tracking-wider">
                <AlertCircle className="w-3 h-3 text-red-500" /> Medical / Allergy
              </div>
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {child.firstName} {child.lastName}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">Age {child.age}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800 font-bold">
                {child.firstName[0]}{child.lastName?.[0]}
              </div>
            </div>
            
            <div className="mt-auto pt-4 flex items-center justify-between">
              {child.currentClass ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                  <MapPin className="w-3 h-3" /> {child.currentClass.name}
                </div>
              ) : (
                <div className="text-xs font-semibold text-[#1a237e] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  Unassigned
                </div>
              )}

              <div className="flex items-center gap-2">
                {canDelete && (
                  <button
                    onClick={() => handleDelete(child.id, `${child.firstName} ${child.lastName}`)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete child"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <Link
                  href={`/children/${child.id}`}
                  className="text-sm font-semibold text-blue-800 hover:text-blue-900 flex items-center gap-1 transition-colors"
                  data-testid={`link-child-${child.id}`}
                >
                  <Eye className="w-4 h-4" /> View
                </Link>
              </div>
            </div>
          </div>
        ))}
        {data?.data?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Baby className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No children found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
