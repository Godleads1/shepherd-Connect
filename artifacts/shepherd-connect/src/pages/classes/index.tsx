import { useState } from "react";
import { useListClasses, useCreateClass, useUpdateClass, useDeleteClass } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Users, MapPin, Edit2, Trash2, Zap, RefreshCw, CheckCircle, ArrowRight, Tv2, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { QueryError } from "@/components/QueryError";


const classSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ageMin: z.coerce.number().min(0),
  ageMax: z.coerce.number().min(0),
  capacity: z.coerce.number().min(1),
  roomLocation: z.string().optional().default(""),
  serviceSlot: z.enum(["7am", "10:30am"]).default("7am"),
  description: z.string().optional()
});
// ageMin/ageMax kept in schema for API compatibility but hidden from UI (auto-derived from class number)

type ClassFormValues = z.infer<typeof classSchema>;

export default function Classes() {
  const { data: classes, isLoading, isError, refetch } = useListClasses();
  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [selectedToPromote, setSelectedToPromote] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const { data: ageOutData, isLoading: ageOutLoading, refetch: refetchAgeOut } = useQuery({
    queryKey: ["age-out-candidates"],
    queryFn: () => apiGet<any>("/children/age-out-candidates"),
    enabled: promoteOpen,
  });

  const promoteMutation = useMutation({
    mutationFn: (childIds: number[]) => apiPost<any>("/children/auto-promote", { childIds }),
    onSuccess: (result) => {
      toast({ title: `${result.promoted} children promoted successfully` });
      setPromoteOpen(false);
      setSelectedToPromote([]);
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: () => toast({ variant: "destructive", title: "Promotion failed" }),
  });

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "", ageMin: 0, ageMax: 0, capacity: 20, roomLocation: "", serviceSlot: "7am", description: ""
    }
  });

  const watchedName = form.watch("name");
  const derivedAge = (() => {
    const m = watchedName.trim().match(/^class\s+(\d+)$/i);
    return m ? parseInt(m[1], 10) : null;
  })();

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ name: "", ageMin: 0, ageMax: 0, capacity: 20, roomLocation: "", serviceSlot: "7am", description: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (cls: any) => {
    setEditingId(cls.id);
    form.reset({
      name: cls.name, ageMin: cls.ageMin, ageMax: cls.ageMax, capacity: cls.capacity,
      roomLocation: cls.roomLocation, serviceSlot: cls.serviceSlot, description: cls.description || ""
    });
    setIsOpen(true);
  };

  const onSubmit = async (data: ClassFormValues) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data });
        toast({ title: "Class updated successfully" });
      } else {
        await createMutation.mutateAsync({ data });
        toast({ title: "Class created successfully" });
      }
      setIsOpen(false);
      refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this class?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Class deleted" });
      refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed" });
    }
  };

  const downloadClassList = async (classId: number, className: string) => {
    const token = localStorage.getItem("token");
    try {
      const resp = await fetch(`/api/reports/class-list?classId=${classId}&format=csv`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${className.replace(/\s+/g, "-").toLowerCase()}-list.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: "destructive", title: "Could not download class list" });
    }
  };

  const getCapacityColor = (enrolled: number, capacity: number) => {
    const percent = (enrolled / capacity) * 100;
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-[#1a237e]";
    return "bg-green-500";
  };

  if (isError) return <QueryError message="Could not load classes." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Classes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPromoteOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <Zap className="w-4 h-4" /> Auto-Promote
          </button>
          <button 
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
            data-testid="button-create-class"
          >
            Add Class
          </button>
        </div>
      </div>

      {/* Auto-Promote Dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Auto-Promote by Age
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Children whose age exceeds their current class max will be moved to the next age-appropriate class.
            </p>
            {ageOutLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : !ageOutData?.candidates?.length ? (
              <div className="py-10 text-center bg-green-50 rounded-2xl border border-green-100">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-800">All children are in the correct class</p>
                <p className="text-xs text-green-600 mt-1">No age-outs detected</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {ageOutData.candidates.length} child{ageOutData.candidates.length !== 1 ? "ren" : ""} eligible for promotion
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {ageOutData.candidates.map((c: any) => (
                    <label key={c.childId}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedToPromote.includes(c.childId) ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-white hover:bg-gray-50"
                      }`}>
                      <input type="checkbox"
                        checked={selectedToPromote.includes(c.childId)}
                        onChange={e => setSelectedToPromote(prev =>
                          e.target.checked ? [...prev, c.childId] : prev.filter(id => id !== c.childId)
                        )}
                        className="w-4 h-4 accent-blue-700"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{c.childName}</p>
                        <p className="text-xs text-gray-500">Age {c.age} · Currently: {c.currentClassName}</p>
                      </div>
                      {c.suggestedClassName ? (
                        <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
                          <ArrowRight className="w-3.5 h-3.5" /> {c.suggestedClassName}
                        </div>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">No target</span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setSelectedToPromote(ageOutData.candidates.filter((c: any) => c.suggestedClassId).map((c: any) => c.childId))}
                    className="text-xs text-blue-700 font-semibold hover:underline">
                    Select all promotable
                  </button>
                  <button
                    onClick={() => promoteMutation.mutate(selectedToPromote)}
                    disabled={selectedToPromote.length === 0 || promoteMutation.isPending}
                    className="px-5 py-2 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center gap-2"
                    style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>
                    {promoteMutation.isPending ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Promoting...</> : `Promote ${selectedToPromote.length} selected`}
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl">
              {editingId ? "Edit Class" : "Create New Class"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Class Name</FormLabel><FormControl><Input className="rounded-xl" placeholder="e.g. Class 5" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              {derivedAge !== null && (
                <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border"
                  style={{ background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Age {derivedAge} · Auto-assigned for all {derivedAge}-year-old children
                </div>
              )}
              
              <FormField control={form.control} name="capacity" render={({ field }) => (
                <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50" onClick={() => setIsOpen(false)}>Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-800 text-white hover:bg-blue-900 disabled:opacity-70">
                  {editingId ? "Update Class" : "Create Class"}
                </button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes?.map((cls) => {
            const percent = Math.min((cls.enrollmentCount / cls.capacity) * 100, 100);
            return (
              <div 
                key={cls.id} 
                className="bg-white rounded-2xl p-5 flex flex-col transition-all duration-300 border border-gray-100"
                style={{ boxShadow: "0 4px 6px -1px rgba(30,58,138,.05), 0 2px 4px -2px rgba(30,58,138,.05)" }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xl">{cls.name}</h3>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1a237e] mt-1">Age {cls.ageMin}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                
                
                <div className="mt-auto space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Capacity Status</span>
                    <span>{cls.enrollmentCount} / {cls.capacity}</span>
                  </div>
                  <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getCapacityColor(cls.enrollmentCount, cls.capacity)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 mt-5 pt-4 border-t border-gray-50">
                  <button
                    className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    style={{ background: "#1e3a8a", color: "white" }}
                    onClick={() => window.open(`${window.location.origin}/classroom-display/${cls.id}`, "_blank")}
                    title="Open TV display for this classroom"
                  >
                    <Tv2 className="w-3.5 h-3.5" /> TV Display
                  </button>
                  <button
                    className="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                    onClick={() => downloadClassList(cls.id, cls.name)}
                    title="Download class list as CSV"
                  >
                    <Download className="w-3.5 h-3.5" /> List
                  </button>
                  <button 
                    className="py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors" 
                    onClick={() => handleOpenEdit(cls)} 
                    data-testid={`button-edit-class-${cls.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button 
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-red-100 text-red-600 hover:bg-red-50 transition-colors flex-shrink-0" 
                    onClick={() => handleDelete(cls.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
