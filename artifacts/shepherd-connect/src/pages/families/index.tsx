import { useState } from "react";
import { useListFamilies, useCreateFamily } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Users, Plus, Phone, MapPin, AlertCircle } from "lucide-react";
import { apiGet } from "@/lib/api-call";

export default function Families() {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data, isLoading, refetch } = useListFamilies({ search });
  const createMutation = useCreateFamily();
  const { toast } = useToast();

  const { data: usersData } = useQuery({
    queryKey: ["parent-users-for-family"],
    queryFn: () => apiGet<{ data: any[]; total: number }>("/users?role=parent&limit=100"),
    enabled: isOpen,
  });
  const parentUsers = usersData?.data || [];

  const [parent1Id, setParent1Id] = useState("");
  const [parent2Id, setParent2Id] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setParent1Id("");
    setParent2Id("");
    setAddress("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
  };

  const handleOpen = () => { resetForm(); setIsOpen(true); };
  const handleClose = () => { setIsOpen(false); resetForm(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parent1Id) {
      toast({ variant: "destructive", title: "Primary parent is required" });
      return;
    }
    setSubmitting(true);
    try {
      const body: any = { parent1Id: Number(parent1Id) };
      if (parent2Id && parent2Id !== "none") body.parent2Id = Number(parent2Id);
      if (address.trim()) body.address = address.trim();
      if (emergencyContactName.trim()) body.emergencyContactName = emergencyContactName.trim();
      if (emergencyContactPhone.trim()) body.emergencyContactPhone = emergencyContactPhone.trim();

      const newFamily = await createMutation.mutateAsync({ data: body });
      toast({ title: "Family created!", description: "The new family has been added successfully." });
      handleClose();
      refetch();
      setLocation(`/families/${newFamily.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not create family", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Families</h1>
        <button
          onClick={handleOpen}
          className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", color: "white", boxShadow: "0 4px 10px rgba(30,58,138,0.2)" }}
          data-testid="button-create-family"
        >
          <Plus className="w-4 h-4" /> Add Family
        </button>
      </div>

      {/* Add Family Dialog */}
      <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              <Users className="w-5 h-5" style={{ color: "#1e3a8a" }} /> Add New Family
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Primary Parent <span className="text-red-500">*</span>
              </label>
              <Select value={parent1Id} onValueChange={setParent1Id}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select primary parent…" />
                </SelectTrigger>
                <SelectContent>
                  {parentUsers.map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName} {u.lastName} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {parentUsers.length === 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> No parent accounts found. Create a parent user first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Second Parent <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Select value={parent2Id} onValueChange={setParent2Id}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select second parent…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {parentUsers.filter((u: any) => String(u.id) !== parent1Id).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName} {u.lastName} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                <MapPin className="w-3 h-3 inline mr-1" />Home Address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g. 12 Victoria Island, Lagos"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  <Phone className="w-3 h-3 inline mr-1" />Emergency Contact
                </label>
                <Input
                  placeholder="Full name"
                  value={emergencyContactName}
                  onChange={e => setEmergencyContactName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  &nbsp;
                </label>
                <Input
                  placeholder="Phone number"
                  value={emergencyContactPhone}
                  onChange={e => setEmergencyContactPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
              <Button
                type="submit"
                disabled={submitting || !parent1Id}
                style={{ background: "linear-gradient(135deg,#1e3a8a,#1d4ed8)", color: "white" }}
              >
                {submitting ? "Creating…" : "Create Family"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search families by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-white border-gray-200 focus-visible:ring-[#1a237e] shadow-sm"
          data-testid="input-search-families"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </>
        ) : data?.data?.map((family) => (
          <div
            key={family.id}
            className="bg-white rounded-2xl p-5 transition-all duration-300 border border-gray-100"
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
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-800 font-bold">
                  {family.parent1?.firstName?.[0]}{family.parent1?.lastName?.[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                    {family.parent1?.firstName} {family.parent1?.lastName}
                  </h3>
                  {family.parent2 && (
                    <p className="text-sm text-gray-500">
                      & {family.parent2.firstName} {family.parent2.lastName}
                    </p>
                  )}
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                {family.familyCode}
              </span>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-blue-800" />
                <span className="font-medium">{family.children?.length || 0}</span> Children
              </div>
              <Link
                href={`/families/${family.id}`}
                className="text-sm font-semibold text-[#1a237e] hover:text-[#283593] flex items-center gap-1 transition-colors"
                data-testid={`link-family-${family.id}`}
              >
                <Eye className="w-4 h-4" /> View Profile
              </Link>
            </div>
          </div>
        ))}
        {data?.data?.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No families found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
