import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useListUsers, useCreateUser, useUpdateUser } from "@workspace/api-client-react";
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
import { Edit2, Trash2, CheckCircle, XCircle, Clock, UserCheck, Users as UsersIcon, Search, RefreshCw, AlertTriangle, Plus, X } from "lucide-react";
import { apiGet, apiPut, apiPost, apiDelete } from "@/lib/api-call";
import { QueryError } from "@/components/QueryError";
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

function DeleteConfirmDialog({ user, onConfirm, onCancel, loading }: {
  user: any; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" /> Remove User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">
            Are you sure you want to <strong>permanently delete</strong> <strong>{user.firstName} {user.lastName}</strong>?
            This cannot be undone — all their data will be removed from the system.
          </p>
          <div className="p-3 bg-gray-50 rounded-xl border text-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
              <p className="text-gray-500 text-xs">{user.email} · {roleBadge(user.role)}</p>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm} disabled={loading}>
              {loading ? "Removing..." : "Yes, Remove"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReassignRoleDialog({ user, isSuperAdmin, onConfirm, onCancel, loading }: {
  user: any; isSuperAdmin: boolean; onConfirm: (role: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<string>(user.role);

  const availableRoles = isSuperAdmin
    ? [
        { value: "parent", label: "Parent" },
        { value: "teacher", label: "Teacher" },
        { value: "attendant", label: "Attendant" },
        { value: "admin", label: "Admin" },
        { value: "super_admin", label: "Super Admin" },
      ]
    : [
        { value: "parent", label: "Parent" },
        { value: "teacher", label: "Teacher" },
      ];

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#1e3a8a" }}>
            <RefreshCw className="w-4 h-4" /> Reassign Role
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border text-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
              <p className="text-gray-500 text-xs">{user.email}</p>
              <div className="mt-1">{roleBadge(user.role)}</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2 uppercase tracking-wide">Assign new role</label>
            <div className="grid grid-cols-2 gap-2">
              {availableRoles.map(r => (
                <button key={r.value} onClick={() => setSelectedRole(r.value)}
                  disabled={r.value === user.role}
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={selectedRole === r.value && r.value !== user.role
                    ? { background: "#1e3a8a", color: "white", borderColor: "#1e3a8a" }
                    : r.value === user.role
                    ? { background: "#f3f4f6", color: "#9ca3af", borderColor: "#e5e7eb" }
                    : { background: "white", color: "#374151", borderColor: "#e5e7eb" }}>
                  {r.label}
                  {r.value === user.role && <span className="block text-[10px] opacity-60">Current</span>}
                </button>
              ))}
            </div>
          </div>

          {!isSuperAdmin && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Admins can only reassign between Parent and Teacher
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>Cancel</Button>
            <Button
              className="flex-1 text-white"
              style={{ background: "#1e3a8a" }}
              disabled={loading || selectedRole === user.role}
              onClick={() => onConfirm(selectedRole)}>
              {loading ? "Saving..." : "Reassign Role"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GrantRoleDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const secondary: string[] = user.secondaryRoles ?? [];
  const allRoles = ["parent", "teacher", "attendant", "admin", "super_admin"];
  const available = allRoles.filter(r => r !== user.role && !secondary.includes(r));

  const grant = async (role: string) => {
    setLoading(true);
    try {
      await apiPost(`/users/${user.id}/grant-role`, { role });
      toast({ title: `${role} access granted to ${user.firstName}` });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Failed to grant role" });
    } finally { setLoading(false); }
  };

  const revoke = async (role: string) => {
    setLoading(true);
    try {
      await apiDelete(`/users/${user.id}/grant-role/${role}`);
      toast({ title: `${role} access revoked from ${user.firstName}` });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Failed to revoke role" });
    } finally { setLoading(false); }
  };

  const roleLabels: Record<string, string> = { parent: "Parent", teacher: "Teacher", attendant: "Attendant", admin: "Admin", super_admin: "Super Admin" };
  const roleColors: Record<string, string> = { parent: "#6b7280", teacher: "#0d9488", attendant: "#ea580c", admin: "#2563eb", super_admin: "#9333ea" };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#1e3a8a" }}>
            <Plus className="w-4 h-4" /> Grant Extra Role Access
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-xl border text-sm flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-gray-500">Primary role: <strong>{roleLabels[user.role] ?? user.role}</strong></p>
            </div>
          </div>

          {secondary.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Current Extra Access</p>
              <div className="flex flex-wrap gap-2">
                {secondary.map(r => (
                  <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                    style={{ background: `${roleColors[r]}15`, color: roleColors[r], borderColor: `${roleColors[r]}30` }}>
                    {roleLabels[r] ?? r}
                    <button onClick={() => revoke(r)} disabled={loading} className="hover:opacity-70 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {available.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Grant Access To</p>
              <div className="grid grid-cols-2 gap-2">
                {available.map(r => (
                  <button key={r} onClick={() => grant(r)} disabled={loading}
                    className="px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: `${roleColors[r]}12`, color: roleColors[r], borderColor: `${roleColors[r]}30` }}>
                    {roleLabels[r] ?? r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            This user will be prompted to choose a role when they sign in.
          </p>

          <Button variant="outline" className="w-full" onClick={onClose} disabled={loading}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const currentRole = currentUser?.role ?? "";
  const isSuperAdmin = currentRole === "super_admin";
  const isAdmin = currentRole === "admin";

  const { data, isLoading, isError, refetch } = useListUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [grantRoleTarget, setGrantRoleTarget] = useState<any>(null);

  const { data: pendingData, refetch: refetchPending } = useQuery({
    queryKey: ["pending-users"],
    queryFn: () => apiGet<{ data: any[]; total: number }>("/users/pending"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/users/${id}/approve`),
    onSuccess: () => { toast({ title: "User approved successfully" }); refetch(); refetchPending(); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiPut(`/users/${id}/reject`),
    onSuccess: () => { toast({ title: "User rejected" }); refetch(); refetchPending(); },
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
    } catch {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiDelete(`/users/${deleteTarget.id}`);
      setDeletedIds(prev => new Set([...prev, deleteTarget.id]));
      toast({ title: "User removed", description: `${deleteTarget.firstName} ${deleteTarget.lastName} has been removed from the system.` });
      refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not remove user", description: e.message });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleConfirmReassign = async (newRole: string) => {
    if (!reassignTarget) return;
    setReassignLoading(true);
    try {
      await apiPost(`/users/${reassignTarget.id}/reassign-role`, { role: newRole });
      toast({ title: "Role updated", description: `${reassignTarget.firstName} ${reassignTarget.lastName} is now a ${newRole}.` });
      refetch();
      setReassignTarget(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "Could not reassign role" });
    } finally {
      setReassignLoading(false);
    }
  };

  const canDeleteUser = (user: any) => {
    if (user.id === currentUser?.id) return false;
    if (isSuperAdmin) return true;
    if (isAdmin) return user.role === "parent" || user.role === "teacher";
    return false;
  };

  const canReassignUser = (user: any) => {
    if (user.id === currentUser?.id) return false;
    if (isSuperAdmin) return user.role !== "super_admin";
    if (isAdmin) return user.role === "parent" || user.role === "teacher";
    return false;
  };

  const allUsers = data?.data || [];
  const pendingUsers = pendingData?.data || [];

  const filtered = allUsers.filter(u => {
    if (deletedIds.has(u.id)) return false;
    const matchRole = !roleFilter || u.role === roleFilter;
    const matchSearch = !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  if (isError) return <QueryError message="Could not load users." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>User Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all system users and approve new sign-ups</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={handleOpenNew} style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }}>Add User</Button>
        )}
      </div>

      {/* Edit/Create dialog */}
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
                      {isSuperAdmin && <SelectItem value="attendant">Attendant</SelectItem>}
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

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          user={deleteTarget}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Reassign role dialog */}
      {reassignTarget && (
        <ReassignRoleDialog
          user={reassignTarget}
          isSuperAdmin={isSuperAdmin}
          onConfirm={handleConfirmReassign}
          onCancel={() => setReassignTarget(null)}
          loading={reassignLoading}
        />
      )}

      {/* Grant extra role dialog */}
      {grantRoleTarget && (
        <GrantRoleDialog
          user={grantRoleTarget}
          onClose={() => { setGrantRoleTarget(null); refetch(); }}
        />
      )}

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
                      <div className="flex gap-1 items-center">
                        {isSuperAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(user)} title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {isSuperAdmin && user.id !== currentUser?.id && (
                          <Button variant="ghost" size="sm" className="text-purple-600 hover:bg-purple-50" title="Grant Extra Role Access"
                            onClick={() => setGrantRoleTarget(user)}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                        {canReassignUser(user) && (
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50" title="Reassign Role"
                            onClick={() => setReassignTarget(user)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
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
                        {canDeleteUser(user) && (
                          <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" title="Remove user"
                            onClick={() => setDeleteTarget(user)}>
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

          {/* Legend for admin */}
          {isAdmin && !isSuperAdmin && (
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span>You can <strong>reassign</strong> or <strong>remove</strong> parents and teachers. Super admin manages all other roles.</span>
            </div>
          )}
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
