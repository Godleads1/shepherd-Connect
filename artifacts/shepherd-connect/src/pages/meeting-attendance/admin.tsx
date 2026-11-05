import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  useListMeetings, useListMeetingTeachers, useCreateMeeting, useGetMeeting, useUpdateMeeting,
  useSetMeetingParticipants, useIssueMeetingQr, useCloseMeeting,
  getListMeetingsQueryKey, getGetMeetingQueryKey, getListMeetingTeachersQueryKey,
  type MeetingDetail, type Meeting,
} from "@workspace/api-client-react";
import { apiGetBlob } from "@/lib/api-call";
import { buildMeetingQrUrl, formatWatDateTime, formatWatWindow, isoToWatInput, meetingErrorMessage } from "@/lib/meeting-attendance";
import { MeetingForm } from "./meeting-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CalendarPlus, Download, FileText, Lock, Pencil, QrCode, RefreshCw, Users } from "lucide-react";

async function saveBlob(path: string, filename: string) {
  const blob = await apiGetBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a);
  try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function StatusPill({ m }: { m: Meeting }) {
  return m.isOpen
    ? <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Open</span>
    : <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Closed</span>;
}

export default function AdminMeetingView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useListMeetings({
    query: { queryKey: getListMeetingsQueryKey(), refetchInterval: q => (q.state.data?.some(m => m.isOpen) ? 15000 : false) },
  });
  const create = useCreateMeeting();
  const meetings = list.data ?? [];

  useEffect(() => {
    if (selectedId == null && meetings.length) setSelectedId(meetings[0].id);
  }, [meetings, selectedId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      <aside className="space-y-3" aria-label="Meetings">
        <Button onClick={() => setCreating(c => !c)} className="w-full bg-blue-800 hover:bg-blue-900" data-testid="button-new-meeting">
          <CalendarPlus className="w-4 h-4 mr-2" /> New meeting
        </Button>
        {creating && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <MeetingForm idPrefix="create-meeting" submitLabel="Create meeting" pending={create.isPending}
              note="New meetings start closed. Select teachers, then generate a QR code to open sign-in."
              onCancel={() => setCreating(false)}
              onSubmit={data => create.mutate({ data }, {
                onSuccess: m => {
                  setCreating(false); setSelectedId(m.id);
                  toast({ title: "Meeting created", description: m.title });
                  void qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
                },
                onError: e => toast({ variant: "destructive", title: "Could not create meeting", description: meetingErrorMessage(e, "Please check the details.").message }),
              })} />
          </div>
        )}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {list.isLoading ? (
            <div className="p-3 space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : list.isError && !list.data ? (
            <div className="py-8 text-center px-4">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Couldn't load meetings.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => void list.refetch()}>Retry</Button>
            </div>
          ) : meetings.length === 0 ? (
            <div className="py-10 text-center px-4">
              <CalendarPlus className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-500 font-semibold text-sm">No meetings yet</p>
              <p className="text-xs text-gray-400 mt-1">Create one to start inviting teachers.</p>
            </div>
          ) : (
            <ul role="listbox" aria-label="Select a meeting">
              {meetings.map(m => (
                <li key={m.id}>
                  <button type="button" role="option" aria-selected={m.id === selectedId} onClick={() => setSelectedId(m.id)}
                    data-testid={`button-select-meeting-${m.id}`}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${m.id === selectedId ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">{m.title}</span>
                      <StatusPill m={m} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatWatWindow(m.startsAt, m.endsAt)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{m.attendedCount} of {m.activatedCount} signed in</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      <main className="min-w-0">
        {selectedId == null ? (
          meetings.length > 0 || list.isLoading ? <Skeleton className="h-96 rounded-2xl" /> : (
            <div className="py-20 text-center bg-white border rounded-2xl">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">Select or create a meeting</p>
            </div>
          )
        ) : <MeetingPanel key={selectedId} id={selectedId} />}
      </main>
    </div>
  );
}

function MeetingPanel({ id }: { id: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const detail = useGetMeeting(id, {
    query: { queryKey: getGetMeetingQueryKey(id), refetchInterval: q => (q.state.data?.meeting.isOpen ? 10000 : false) },
  });
  const isOpen = !!detail.data?.meeting.isOpen;
  const teachers = useListMeetingTeachers({ query: { queryKey: getListMeetingTeachersQueryKey(), refetchInterval: isOpen ? 30000 : false } });
  const update = useUpdateMeeting();
  const setParticipants = useSetMeetingParticipants();
  const issueQr = useIssueMeetingQr();
  const close = useCloseMeeting();

  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"replace" | "close" | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const initFor = useRef<number | null>(null);
  const savedIds = useRef<string>("");

  const activeIds = (d: MeetingDetail) => d.participants.filter(p => p.active).map(p => p.userId).sort((a, b) => a - b);

  useEffect(() => {
    if (detail.data && initFor.current !== id) {
      initFor.current = id;
      const ids = activeIds(detail.data);
      setSelected(new Set(ids)); savedIds.current = ids.join(",");
    }
  }, [detail.data, id]);

  // A closed meeting has no valid QR; drop any displayed code.
  useEffect(() => { if (detail.data && !detail.data.meeting.isOpen) setQrUrl(null); }, [detail.data]);

  const dirty = [...selected].sort((a, b) => a - b).join(",") !== savedIds.current;

  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetMeetingQueryKey(id) });
  };
  const patchMeeting = (m: Meeting) => qc.setQueryData<MeetingDetail>(getGetMeetingQueryKey(id), old => (old ? { ...old, meeting: m } : old));
  const fail = (title: string) => (e: unknown) => toast({ variant: "destructive", title, description: meetingErrorMessage(e, "Please try again.").message });

  const teacherRows = useMemo(() => {
    const names = new Map<number, string>();
    (teachers.data ?? []).forEach(t => names.set(t.userId, t.name));
    detail.data?.participants.forEach(p => { if (!names.has(p.userId)) names.set(p.userId, p.name); });
    const q = filter.trim().toLowerCase();
    return [...names.entries()].map(([userId, name]) => ({ userId, name }))
      .filter(t => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers.data, detail.data, filter]);

  if (detail.isLoading) return <div className="space-y-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;
  if (detail.isError && !detail.data) {
    return (
      <div className="py-12 text-center bg-white border border-red-100 rounded-2xl">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
        <p className="text-gray-700 font-semibold">Couldn't load this meeting</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void detail.refetch()}>Retry</Button>
      </div>
    );
  }
  const d = detail.data!;
  const m = d.meeting;

  const saveParticipants = () => setParticipants.mutate({ id, data: { teacherIds: [...selected] } }, {
    onSuccess: res => {
      qc.setQueryData(getGetMeetingQueryKey(id), res);
      const ids = activeIds(res); savedIds.current = ids.join(","); setSelected(new Set(ids));
      toast({ title: "Teacher activations saved", description: `${ids.length} teacher${ids.length === 1 ? "" : "s"} activated for this meeting.` });
      void qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
    },
    onError: fail("Could not save activations"),
  });

  const generate = () => issueQr.mutate({ id }, {
    onSuccess: res => {
      setQrUrl(buildMeetingQrUrl(window.location.origin, import.meta.env.BASE_URL, res.token));
      patchMeeting(res.meeting);
      toast({ title: "Meeting QR is live", description: "Any previous code for this meeting no longer works." });
      refreshAll();
    },
    onError: fail("Could not generate QR"),
  });

  const doClose = () => close.mutate({ id }, {
    onSuccess: res => { setQrUrl(null); patchMeeting(res); toast({ title: "Meeting closed", description: "The QR code is revoked. Attendance is kept." }); refreshAll(); },
    onError: fail("Could not close meeting"),
  });

  const download = async (format: "csv" | "pdf") => {
    setDownloading(format);
    try {
      await saveBlob(`/meetings/${id}/report?format=${format}`, `meeting-attendance-${id}.${format}`);
      toast({ title: `Meeting ${format.toUpperCase()} downloaded` });
    } catch (e) {
      toast({ variant: "destructive", title: "Download failed", description: e instanceof Error ? e.message : undefined });
    } finally { setDownloading(null); }
  };

  const signedIn = d.participants.filter(p => p.signedInAt).length;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        {editing ? (
          <MeetingForm idPrefix="edit-meeting" submitLabel="Save changes" pending={update.isPending}
            initial={{ title: m.title, startsAt: isoToWatInput(m.startsAt), endsAt: isoToWatInput(m.endsAt) }}
            note="Saving closes the meeting and revokes its QR code. Recorded attendance is kept."
            onCancel={() => setEditing(false)}
            onSubmit={data => update.mutate({ id, data }, {
              onSuccess: res => { setEditing(false); setQrUrl(null); patchMeeting(res); toast({ title: "Meeting updated", description: "Generate a new QR to reopen sign-in." }); refreshAll(); },
              onError: fail("Could not update meeting"),
            })} />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-gray-900" data-testid="text-meeting-title">{m.title}</h2><StatusPill m={m} /></div>
              <p className="text-sm text-gray-500 mt-1">{formatWatWindow(m.startsAt, m.endsAt)}</p>
              <p className="text-sm text-gray-700 mt-2 tabular-nums" data-testid="text-meeting-counts"><strong>{signedIn}</strong> of <strong>{m.activatedCount}</strong> activated teachers signed in</p>
              {detail.isError && <p className="text-xs text-amber-700 mt-1">Live refresh is failing — showing the last loaded data.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-meeting"><Pencil className="w-4 h-4 mr-1.5" />Edit</Button>
              <Button variant="outline" size="sm" disabled={!!downloading} onClick={() => void download("csv")} data-testid="button-download-meeting-csv">
                <Download className="w-4 h-4 mr-1.5" />{downloading === "csv" ? "Preparing…" : "CSV"}
              </Button>
              <Button variant="outline" size="sm" disabled={!!downloading} onClick={() => void download("pdf")} data-testid="button-download-meeting-pdf">
                <FileText className="w-4 h-4 mr-1.5" />{downloading === "pdf" ? "Preparing…" : "PDF"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" aria-labelledby="qr-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="qr-heading" className="font-bold text-gray-800">Sign-in QR code</h3>
            <p className="text-xs text-gray-500">Generating a code opens the meeting. Closing revokes it.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={issueQr.isPending || dirty || m.activatedCount === 0}
              onClick={() => (m.isOpen ? setConfirm("replace") : generate())}
              className="bg-blue-800 hover:bg-blue-900" data-testid="button-generate-qr">
              <QrCode className="w-4 h-4 mr-1.5" />{issueQr.isPending ? "Generating…" : m.isOpen ? "Replace QR" : "Generate QR"}
            </Button>
            {m.isOpen && (
              <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" disabled={close.isPending}
                onClick={() => setConfirm("close")} data-testid="button-close-meeting">
                <Lock className="w-4 h-4 mr-1.5" />{close.isPending ? "Closing…" : "Close meeting"}
              </Button>
            )}
          </div>
        </div>
        {(dirty || m.activatedCount === 0) && <p className="text-xs text-amber-700 mt-2">{dirty ? "Save teacher activations before generating a QR code." : "Activate at least one teacher first."}</p>}
        {qrUrl && m.isOpen ? (
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-5 rounded-xl bg-blue-50/60 border border-blue-100 p-4">
            <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={qrUrl} size={208} level="M" aria-label="Meeting sign-in QR code" data-testid="img-meeting-qr" /></div>
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-semibold">Display this for teachers to scan.</p>
              <p>Teachers scan with the app's meeting scanner or their phone camera, then confirm on their own account.</p>
              <p className="text-xs text-gray-500">This code is shown only once. If you leave this page, use Replace QR to show a new one.</p>
            </div>
          </div>
        ) : m.isOpen ? (
          <p className="mt-4 text-sm text-gray-600 rounded-xl bg-gray-50 p-4">Sign-in is open with a previously issued code. Replace the QR to display a new one here.</p>
        ) : null}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden" aria-labelledby="teachers-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
          <h3 id="teachers-heading" className="font-bold text-gray-800">Teachers &amp; attendance</h3>
          <div className="flex gap-2 items-center">
            <Input aria-label="Filter teachers" placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} className="h-8 w-36" data-testid="input-filter-teachers" />
            <Button size="sm" disabled={!dirty || setParticipants.isPending} onClick={saveParticipants} className="bg-blue-800 hover:bg-blue-900" data-testid="button-save-participants">
              {setParticipants.isPending ? "Saving…" : "Save activations"}
            </Button>
          </div>
        </div>
        {teachers.isLoading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : teachers.isError && !teachers.data ? (
          <div className="py-8 text-center"><p className="text-sm text-gray-600">Couldn't load teachers.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => void teachers.refetch()}><RefreshCw className="w-4 h-4 mr-1" />Retry</Button></div>
        ) : teacherRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">{filter ? "No teachers match this filter." : "No eligible teacher accounts found."}</p>
        ) : (
          <ul className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {teacherRows.map(t => {
              const p = d.participants.find(x => x.userId === t.userId);
              const checked = selected.has(t.userId);
              return (
                <li key={t.userId} className="flex items-center gap-3 px-4 py-2.5" data-testid={`row-participant-${t.userId}`}>
                  <Checkbox id={`teacher-${t.userId}`} checked={checked} data-testid={`checkbox-teacher-${t.userId}`}
                    onCheckedChange={v => setSelected(s => { const n = new Set(s); if (v) n.add(t.userId); else n.delete(t.userId); return n; })} />
                  <label htmlFor={`teacher-${t.userId}`} className="flex-1 text-sm font-medium text-gray-800 cursor-pointer">{t.name}</label>
                  {p?.signedInAt ? (
                    <span className="text-xs font-semibold text-emerald-700 tabular-nums">{formatWatDateTime(p.signedInAt)}</span>
                  ) : p?.active ? <span className="text-xs text-gray-400">Not signed in</span> : <span className="text-xs text-gray-300">Not activated</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog open={confirm !== null} onOpenChange={o => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "replace" ? "Replace the meeting QR code?" : "Close this meeting?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "replace"
                ? "The current code will stop working immediately. Teachers who have not signed in must scan the new code."
                : "The QR code will be revoked and no further sign-ins accepted. Attendance already recorded is kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-dialog" onClick={() => { if (confirm === "replace") generate(); else doClose(); setConfirm(null); }}>
              {confirm === "replace" ? "Replace QR" : "Close meeting"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
