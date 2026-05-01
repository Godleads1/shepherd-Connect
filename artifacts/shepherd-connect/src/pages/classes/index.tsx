import { useState } from "react";
import { useListClasses, useCreateClass, useUpdateClass, useDeleteClass } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      name: "",
      ageMin: 0,
      ageMax: 5,
      capacity: 20,
      roomLocation: "",
      serviceSlot: "9am",
      description: ""
    }
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({
      name: "", ageMin: 0, ageMax: 5, capacity: 20, roomLocation: "", serviceSlot: "9am", description: ""
    });
    setIsOpen(true);
  };

  const handleOpenEdit = (cls: any) => {
    setEditingId(cls.id);
    form.reset({
      name: cls.name,
      ageMin: cls.ageMin,
      ageMax: cls.ageMax,
      capacity: cls.capacity,
      roomLocation: cls.roomLocation,
      serviceSlot: cls.serviceSlot,
      description: cls.description || ""
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
    if (percent >= 100) return "bg-destructive";
    if (percent >= 80) return "bg-accent";
    return "bg-success";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary">Classes</h1>
        <Button onClick={handleOpenNew} data-testid="button-create-class">Add Class</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Class" : "Create New Class"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Class Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="ageMin" render={({ field }) => (
                  <FormItem><FormLabel>Min Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ageMax" render={({ field }) => (
                  <FormItem><FormLabel>Max Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="capacity" render={({ field }) => (
                  <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="serviceSlot" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Slot</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                <FormItem><FormLabel>Room Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Update Class" : "Create Class"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes?.map((cls) => {
            const percent = Math.min((cls.enrollmentCount / cls.capacity) * 100, 100);
            return (
              <Card key={cls.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{cls.name}</span>
                    <span className="text-sm font-normal text-muted-foreground">Ages {cls.ageMin}-{cls.ageMax}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" /> {cls.roomLocation}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" /> {cls.serviceSlot} Service
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Enrolled</span>
                      <span className="font-medium">{cls.enrollmentCount} / {cls.capacity}</span>
                    </div>
                    <Progress 
                      value={percent} 
                      className="h-2"
                      indicatorClassName={getCapacityColor(cls.enrollmentCount, cls.capacity)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleOpenEdit(cls)} data-testid={`button-edit-class-${cls.id}`}>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(cls.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
