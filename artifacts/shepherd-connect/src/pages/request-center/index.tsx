import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import {
  getGetParentRequestQueryKey,
  getListParentRequestsQueryKey,
  type ParentRequestType,
  useCancelCustodyRequest,
  useCreateParentPickupRequest,
  useGetParentRequest,
  useListParentRequests,
  useRequestCustodyEpisode,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarDays, CarFront, ChevronRight, ClipboardList, Loader2, MessageSquare, RefreshCw, ShieldCheck, Star, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { watServiceDateAt } from "@/lib/wat-date";

const requestTypeOptions: Array<{ type: ParentRequestType | "all"; label: string; icon: typeof ShieldCheck }> = [
  { type: "all", label: "All", icon: ClipboardList },
  { type: "custody", label: "Check-in", icon: ShieldCheck },
  { type: "pickup", label: "Pickup", icon: CarFront },
  { type: "delegate", label: "Delegates", icon: UserCheck },
  { type: "class_change", label: "Class", icon: CalendarDays },
  { type: "concern", label: "Concerns", icon: MessageSquare },
  { type: "feedback", label: "Feedback", icon: Star },
];

type CustodyForm = {
  childId: string;
  serviceDate: string;
  requestedServices: "first" | "second" | "both";
};

function statusStyle(status: string): string {
  if (["accepted", "approved", "resolved", "submitted"].includes(status)) return "bg-emerald-100 text-emerald-700";
  if (["cancelled", "rejected", "denied", "closed"].includes(status)) return "bg-slate-100 text-slate-600";
  return "bg-amber-100 text-amber-800";
}

export default function RequestCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<ParentRequestType | "all">("all");
  const [status, setStatus] = useState("all");
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [detail, setDetail] = useState<{ type: ParentRequestType; id: string } | null>(null);
  const params = {
    ...(type === "all" ? {} : { type }),
    ...(status === "all" ? {} : { status }),
  };
  const center = useListParentRequests(params, {
    query: {
      queryKey: getListParentRequestsQueryKey(params),
      refetchInterval: 15000,
      staleTime: 5000,
    },
  });
  const detailQuery = useGetParentRequest(detail?.type ?? "custody", detail?.id ?? "0", {
    query: {
      enabled: detail != null,
      queryKey: getGetParentRequestQueryKey(detail?.type ?? "custody", detail?.id ?? "0"),
    },
  });
  const custodyMutation = useRequestCustodyEpisode();
  const cancelMutation = useCancelCustodyRequest();
  const pickupMutation = useCreateParentPickupRequest();
  const form = useForm<CustodyForm>({
    defaultValues: { childId: "", serviceDate: watServiceDateAt(), requestedServices: "both" },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/parent-requests"] });
  const submitCustody = form.handleSubmit(async values => {
    try {
      await custodyMutation.mutateAsync({
        data: {
          childId: Number(values.childId),
          serviceDate: values.serviceDate,
          requestedServices: values.requestedServices,
          eventId: crypto.randomUUID(),
        },
      });
      setCustodyOpen(false);
      form.reset({ childId: "", serviceDate: watServiceDateAt(), requestedServices: "both" });
      await refresh();
      toast({ title: "Check-in request sent", description: "Support will confirm when custody is accepted." });
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Could not create request" });
    }
  });

  const requestPickup = async (childId: number, childName: string) => {
    try {
      const result = await pickupMutation.mutateAsync({ data: { childId } });
      await refresh();
      toast({
        title: result.duplicate ? "Pickup request already active" : `Pickup requested for ${childName}`,
        description: result.message,
      });
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Could not request pickup" });
    }
  };

  const cancelCustody = async (id: number) => {
    try {
      await cancelMutation.mutateAsync({ id });
      setDetail(null);
      await refresh();
      toast({ title: "Check-in request cancelled" });
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Could not cancel request" });
    }
  };

  const activePickupChildren = new Set(
    (center.data?.items ?? []).filter(item => item.requestType === "pickup" && item.status === "requested").map(item => item.childId),
  );
  const visibleStatuses = [...new Set((center.data?.items ?? []).map(item => item.status))];

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <header className="rounded-3xl bg-gradient-to-br from-[#172554] to-[#1d4ed8] p-5 text-white sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-200">Family care</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl" data-testid="text-request-center-title">Requests</h1>
            <p className="mt-2 max-w-xl text-sm text-blue-100">Manage check-in and pickup, then follow every family request in one place.</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => center.refetch()}
            disabled={center.isFetching}
            data-testid="button-refresh-requests"
            aria-label="Refresh requests"
          >
            <RefreshCw className={`h-4 w-4 ${center.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button className="h-11 bg-white text-[#1e3a8a] hover:bg-blue-50" onClick={() => setCustodyOpen(true)} data-testid="button-new-custody">
            <ShieldCheck className="mr-2 h-4 w-4" /> Request check-in
          </Button>
          <Link href="/pickup-delegates">
            <Button className="h-11 w-full bg-blue-500/40 text-white hover:bg-blue-500/60" data-testid="link-manage-delegates">
              <UserCheck className="mr-2 h-4 w-4" /> Delegates
            </Button>
          </Link>
        </div>
      </header>

      <section aria-label="Pickup checked-in children">
        <h2 className="mb-2 text-sm font-bold text-slate-800">Pickup now</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(center.data?.children ?? []).map(child => {
            const active = activePickupChildren.has(child.id);
            return (
              <Button
                key={child.id}
                variant="outline"
                className="h-auto min-h-14 justify-between rounded-2xl px-4 py-3"
                disabled={!child.checkedIn || active || pickupMutation.isPending}
                onClick={() => requestPickup(child.id, child.firstName)}
                data-testid={`button-pickup-${child.id}`}
              >
                <span className="text-left">
                  <span className="block font-semibold">{child.firstName} {child.lastName}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {active ? "Classroom notified" : child.checkedIn ? "Checked in — ready to request" : "Not currently checked in"}
                  </span>
                </span>
                {active ? <BellRing className="h-5 w-5 text-emerald-600" /> : <CarFront className="h-5 w-5" />}
              </Button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {requestTypeOptions.map(option => {
            const Icon = option.icon;
            const count = option.type === "all" ? center.data?.items.length : center.data?.counts[option.type];
            return (
              <button
                type="button"
                key={option.type}
                onClick={() => setType(option.type)}
                className={`min-w-[92px] rounded-2xl border px-3 py-3 text-left transition ${type === option.type ? "border-[#1e3a8a] bg-blue-50 text-[#1e3a8a]" : "bg-white text-slate-600"}`}
                data-testid={`filter-type-${option.type}`}
              >
                <Icon className="mb-2 h-4 w-4" />
                <span className="block text-xs font-semibold">{option.label}</span>
                <span className="text-lg font-bold" data-testid={`count-type-${option.type}`}>{count ?? 0}</span>
              </button>
            );
          })}
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="mt-2 w-full sm:w-52" data-testid="select-request-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {visibleStatuses.map(itemStatus => <SelectItem key={itemStatus} value={itemStatus}>{itemStatus.replaceAll("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-2" aria-label="Request history">
        {center.isLoading && [1, 2, 3].map(item => <Skeleton key={item} className="h-24 rounded-2xl" />)}
        {center.isError && (
          <Card><CardContent className="p-5 text-center">
            <p className="text-sm text-destructive" data-testid="status-request-error">Requests could not be loaded.</p>
            <Button variant="outline" className="mt-3" onClick={() => center.refetch()} data-testid="button-retry-requests">Try again</Button>
          </CardContent></Card>
        )}
        {!center.isLoading && !center.isError && center.data?.items.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground" data-testid="status-request-empty">No requests match this filter.</CardContent></Card>
        )}
        {(center.data?.items ?? []).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDetail({ type: item.requestType, id: String(item.sourceId) })}
            className="flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-200"
            data-testid={`card-request-${item.id}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${statusStyle(item.status)}`}>{item.status.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{item.childName ?? item.summary ?? "Family request"}</p>
              <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </section>

      <Dialog open={custodyOpen} onOpenChange={setCustodyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request child check-in</DialogTitle>
            <DialogDescription>Choose your child, service date and service. Support will confirm the handover.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={submitCustody} className="space-y-4">
              <FormField control={form.control} name="childId" rules={{ required: "Choose a child" }} render={({ field }) => (
                <FormItem><FormLabel>Child</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-custody-child"><SelectValue placeholder="Choose a child" /></SelectTrigger></FormControl>
                  <SelectContent>{(center.data?.children ?? []).map(child => <SelectItem key={child.id} value={String(child.id)}>{child.firstName} {child.lastName}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="serviceDate" rules={{ required: "Choose a date" }} render={({ field }) => (
                <FormItem><FormLabel>Service date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-custody-date" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="requestedServices" render={({ field }) => (
                <FormItem><FormLabel>Service</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger data-testid="select-custody-service"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent><SelectItem value="first">1st service</SelectItem><SelectItem value="second">2nd service</SelectItem><SelectItem value="both">Both services</SelectItem></SelectContent>
                </Select></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={custodyMutation.isPending} data-testid="button-submit-custody">
                {custodyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={detail != null} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request details</DialogTitle>
            <DialogDescription>Review the current status and available next action.</DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading && <Skeleton className="h-32 rounded-xl" />}
          {detailQuery.data && (
            <div className="space-y-4" data-testid="panel-request-detail">
              <div>
                <p className="font-bold">{detailQuery.data.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detailQuery.data.childName ?? detailQuery.data.summary}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-sm">Status</span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${statusStyle(detailQuery.data.status)}`}>{detailQuery.data.status.replaceAll("_", " ")}</span>
              </div>
              {detailQuery.data.requestType === "custody" && detailQuery.data.status === "requested" && typeof detailQuery.data.sourceId === "number" && (
                <Button variant="destructive" className="w-full" onClick={() => cancelCustody(detailQuery.data.sourceId as number)} disabled={cancelMutation.isPending} data-testid="button-cancel-custody">Cancel request</Button>
              )}
              <Link href={detailQuery.data.deepLink}>
                <Button variant="outline" className="w-full" data-testid="link-open-request-flow">Open full request flow <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}