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
import { Users, MapPin, Clock, Edit2, Trash2 } from "lucide-react";

const classSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ageMin: z.coerce.number().min(0),
  ageMax: z.coerce.number().min(0),
  capacity: z.coerce.number().min(1),
  roomLocation: z.string().min(1, "Room location is required"),
  serviceSlot: z.enum(["7am", "9am", "11am", "1pm"]),
  description: z.string().optional()
});

type ClassFormValues = z.infer<typeof classSchema>;

export default function Classes() {
  const { data: classes, isLoading, refetch } = useListClasses();
  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "", ageMin: 0, ageMax: 5, capacity: 20, roomLocation: "", serviceSlot: "9am", description: ""
    }
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ name: "", ageMin: 0, ageMax: 5, capacity: 20, roomLocation: "", serviceSlot: "9am", description: "" });
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

  const getCapacityColor = (enrolled: number, capacity: number) => {
    const percent = (enrolled / capacity) * 100;
    if (percent >= 100) return "bg-red-500";
    if (percent >= 80) return "bg-[#1a237e]";
    return "bg-green-500";
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Classes</h1>
        <button 
          onClick={handleOpenNew}
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
          data-testid="button-create-class"
        >
          Add Class
        </button>
      </div>

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
                <FormItem><FormLabel>Class Name</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="ageMin" render={({ field }) => (
                  <FormItem><FormLabel>Min Age</FormLabel><FormControl><Input type="number" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ageMax" render={({ field }) => (
                  <FormItem><FormLabel>Max Age</FormLabel><FormControl><Input type="number" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="serviceSlot" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Slot</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="7am">7:00 AM</SelectItem>
                        <SelectItem value="9am">9:00 AM</SelectItem>
                        <SelectItem value="11am">11:00 AM</SelectItem>
                        <SelectItem value="1pm">1:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="roomLocation" render={({ field }) => (
                <FormItem><FormLabel>Room Location</FormLabel><FormControl><Input className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1a237e] mt-1">Ages {cls.ageMin}-{cls.ageMax}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <MapPin className="w-4 h-4 text-blue-800 flex-shrink-0" /> 
                    <span className="font-medium truncate">{cls.roomLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                    <Clock className="w-4 h-4 text-blue-800 flex-shrink-0" /> 
                    <span className="font-medium">{cls.serviceSlot} Service</span>
                  </div>
                </div>
                
                <div className="mt-auto space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Capacity Status</span>
                    <span>{cls.enrollmentCount} / {cls.capacity}</span>
                  </div>
                  <Progress 
                    value={percent} 
                    className="h-2.5 bg-gray-100 rounded-full overflow-hidden"
                    indicatorClassName={getCapacityColor(cls.enrollmentCount, cls.capacity)}
                  />
                </div>
                
                <div className="flex gap-2 mt-5 pt-4 border-t border-gray-50">
                  <button 
                    className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors" 
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
