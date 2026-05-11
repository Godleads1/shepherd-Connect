import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Edit2, Trash2, CheckCircle, XCircle, Clock, UserCheck, Users as UsersIcon, Search } from "lucide-react";
import { apiGet, apiPut } from "@/lib/api-call";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const userSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(["super_admin", "admin", "teacher", "attendant", "parent"]),
  isActive: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userSchema>;

function statusBadge(u: any) {
  if (u.status === "pending_approval") return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending Approval</Badge>;
  if (u.status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    super_admin: "bg-purple-100 text-purple-800 border-purple-200",
    admin: "bg-blue-100 text-blue-800 border-blue-200",
    teacher: "bg-teal-100 text-teal-800 border-teal-200",
    attendant: "bg-orange-100 text-orange-800 border-orange-200",
    parent: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return <Badge className={colors[role] || ""}>{role.replace("_", " ")}</Badge>;
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const currentRole = currentUser?.role ?? "";
  const isSuperAdmin = currentRole === "super_admin";

  const { data, isLoading, refetch } = useListUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ["pending-users"],
    queryFn: () => apiGet<{ data: any[]; total: number }>("/users/pending"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/users/${id}/approve`),
    onSuccess: () => {
      toast({ title: "User approved successfully" });
      refetch();
      refetchPending();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/users/${id}/reject`),
    onSuccess: () => {
      toast({ title: "User rejected" });
      refetch();
      refetchPending();
    },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "", role: "parent", isActive: true },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ firstName: "", lastName: "", email: "", phone: "", password: "", role: "teacher", isActive: true });
    setIsOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingId(user.id);
    form.reset({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone || "", password: "", role: user.role, isActive: user.isActive });
    setIsOpen(true);
  };

  const onSubmit = async (data: UserFormValues) => {
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: { firstName: data.firstName, lastName: data.lastName, phone: data.phone, role: data.role, isActive: data.isActive } });
        toast({ title: "User updated successfully" });
      } else {
        if (!data.password) { form.setError("password", { message: "Password required for new users" }); return; }
        await createMutation.mutateAsync({ data: data as any });
        toast({ title: "User created successfully" });
      }
      setIsOpen(false);
      refetch();
      refetchPending();
    } catch (e) {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const handleDelete = async (user: any) => {
    if (user.role === "super_admin" || (user.role === "admin" && !isSuperAdmin)) {
      toast({ variant: "destructive", title: "Not allowed", description: "You cannot deactivate this account." });
      return;
    }
    if (!confirm(`Deactivate ${user.firstName} ${user.lastName}?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: user.id });
      toast({ title: "User deactivated" });
      refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const allUsers = data?.data || [];
  const pendingUsers = pendingData?.data || [];

  const filtered = allUsers.filter(u => {
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchSearch = !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all system users and approve new sign-ups</p>
        </div>
        <Button onClick={handleOpenNew} style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>Add User</Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Edit User" : "Create New User"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" disabled={!!editingId} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              {!editingId && (
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                      {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="attendant">Attendant</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {editingId && (
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Update User" : "Create User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4" /> All Users
            <Badge variant="secondary" className="ml-1 text-xs">{allUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Approval
            {pendingUsers.length > 0 && (
              <Badge className="ml-1 text-xs bg-amber-500 text-white border-0">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={roleFilter || "all"} onValueChange={v => setRoleFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="attendant">Attendant</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ))
                ) : filtered.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        {user.firstName} {user.lastName}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell className="text-gray-600">{user.phone || "—"}</TableCell>
                    <TableCell>{roleBadge(user.role)}</TableCell>
                    <TableCell>{statusBadge(user)}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(user)} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {user.status === "pending_approval" && (
                          <>
                            <Button variant="ghost" size="sm" className="text-green-600 hover:bg-green-50" title="Approve"
                              onClick={() => approveMutation.mutate(user.id)} disabled={approveMutation.isPending}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" title="Reject"
                              onClick={() => rejectMutation.mutate(user.id)} disabled={rejectMutation.isPending}>
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {(isSuperAdmin || (user.role !== "super_admin" && user.role !== "admin")) && (
                          <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" title="Deactivate" onClick={() => handleDelete(user)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">No users found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pendingUsers.length === 0 ? (
            <div className="text-center py-16 border rounded-xl bg-white">
              <UserCheck className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No pending approvals</p>
              <p className="text-gray-400 text-sm mt-1">All sign-ups have been reviewed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user: any) => (
                <div key={user.id} className="bg-white border rounded-xl p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {roleBadge(user.role)}
                        <span className="text-xs text-gray-400">Signed up {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                      onClick={() => approveMutation.mutate(user.id)} disabled={approveMutation.isPending}>
                      <CheckCircle className="w-4 h-4" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                      onClick={() => rejectMutation.mutate(user.id)} disabled={rejectMutation.isPending}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
