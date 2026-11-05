import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMeetings, useScanMeeting, getListMeetingsQueryKey, type MeetingScanResult } from "@workspace/api-client-react";
import QrCameraScanner from "@/components/QrCameraScanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clearPendingMeetingToken, extractMeetingToken, formatWatDateTime, formatWatWindow, meetingErrorMessage,
  readPendingMeetingToken, savePendingMeetingToken, scanErrorCopy,
} from "@/lib/meeting-attendance";
import { AlertTriangle, CalendarCheck2, CheckCircle2, QrCode, RefreshCw, XCircle } from "lucide-react";

export default function TeacherMeetingView({ initialToken }: { initialToken: string | null }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(initialToken ?? readPendingMeetingToken());
  const [scanning, setScanning] = useState(false);
  const [scanBadCode, setScanBadCode] = useState(false);
  const [result, setResult] = useState<MeetingScanResult | null>(null);
  const [failure, setFailure] = useState<{ title: string; body: string } | null>(null);

  const meetings = useListMeetings({
    query: { queryKey: getListMeetingsQueryKey(), refetchInterval: q => (q.state.data?.some(m => m.isOpen) ? 15000 : 60000) },
  });
  const scan = useScanMeeting();

  useEffect(() => { if (initialToken) setPending(initialToken); }, [initialToken]);

  const onScan = useCallback((raw: string) => {
    setScanning(false);
    const token = extractMeetingToken(raw);
    if (!token) { setScanBadCode(true); return; }
    setScanBadCode(false); setResult(null); setFailure(null);
    savePendingMeetingToken(token);
    setPending(token);
  }, []);
  const onClose = useCallback(() => setScanning(false), []);

  const discard = () => { clearPendingMeetingToken(); setPending(null); setFailure(null); };

  const confirm = () => {
    if (!pending) return;
    setFailure(null);
    scan.mutate({ data: { token: pending } }, {
      onSuccess: res => {
        clearPendingMeetingToken();
        setPending(null);
        setResult(res);
        void qc.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      },
      onError: err => {
        const { status, message } = meetingErrorMessage(err, "The server rejected this code.");
        setFailure(scanErrorCopy(status, message));
        // A definitive rejection means the code is unusable; network failures keep it for retry.
        if (status && status >= 400 && status < 500 && status !== 401 && status !== 429) { clearPendingMeetingToken(); setPending(null); }
      },
    });
  };

  const list = meetings.data ?? [];

  return (
    <div className="space-y-5">
      {scanning && <QrCameraScanner onScan={onScan} onClose={onClose} hint="Point the camera at the meeting QR code" />}

      <section className="rounded-2xl p-5 text-white shadow-sm" style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)" }} aria-labelledby="sign-in-heading">
        <h2 id="sign-in-heading" className="font-bold text-lg flex items-center gap-2"><QrCode className="w-5 h-5" /> Meeting sign-in</h2>
        <p className="text-white/75 text-sm mt-1">This is for staff meetings only. It does not record Sunday service attendance.</p>
        {!pending && !result && (
          <Button onClick={() => { setScanBadCode(false); setFailure(null); setScanning(true); }}
            className="mt-4 bg-yellow-400 text-blue-950 hover:bg-yellow-300 font-semibold" data-testid="button-open-meeting-scanner">
            <QrCode className="w-4 h-4 mr-2" /> Scan meeting QR
          </Button>
        )}
      </section>

      {scanBadCode && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" data-testid="status-wrong-qr">
          <XCircle className="w-5 h-5 shrink-0 text-red-500" />
          <div><p className="font-semibold">That is not a meeting QR code</p><p>Family or Sunday service codes cannot be used here. Scan the code shown for this meeting.</p></div>
        </div>
      )}

      {pending && (
        <div className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm" data-testid="panel-confirm-meeting">
          <p className="font-bold text-gray-900">Confirm your attendance</p>
          <p className="text-sm text-gray-600 mt-1">A meeting code is ready. You will be signed in as yourself. Nothing is recorded until you confirm.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={confirm} disabled={scan.isPending} className="bg-blue-800 hover:bg-blue-900" data-testid="button-confirm-meeting">
              {scan.isPending ? "Signing in…" : "Confirm my attendance"}
            </Button>
            <Button variant="outline" onClick={discard} disabled={scan.isPending} data-testid="button-discard-meeting">Not now</Button>
          </div>
        </div>
      )}

      {failure && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" data-testid="status-meeting-scan-error">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="font-semibold">{failure.title}</p><p>{failure.body}</p>
            <div className="flex gap-2 mt-2">
              {pending && <Button size="sm" variant="outline" onClick={confirm}>Try again</Button>}
              <Button size="sm" variant="outline" onClick={() => { setFailure(null); setScanning(true); }}>Scan again</Button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div role="status" className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" data-testid="status-meeting-signed-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold">{result.duplicate ? "You were already signed in" : "You are signed in"}</p>
            <p>{result.title} — {formatWatDateTime(result.signedInAt)}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setResult(null)}>Done</Button>
          </div>
        </div>
      )}

      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm" aria-labelledby="invites-heading">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 id="invites-heading" className="font-bold text-gray-800">My meeting invitations</h2>
          <Button size="sm" variant="ghost" onClick={() => void meetings.refetch()} aria-label="Refresh invitations">
            <RefreshCw className={`w-4 h-4 ${meetings.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {meetings.isLoading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : meetings.isError && !meetings.data ? (
          <div className="py-10 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Couldn't load your invitations.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void meetings.refetch()}>Retry</Button>
          </div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarCheck2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 font-semibold">No meeting invitations</p>
            <p className="text-sm text-gray-400 mt-1">When an admin activates you for a meeting it will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {list.map(m => (
              <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-3" data-testid={`row-invite-${m.id}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{m.title}</p>
                  <p className="text-xs text-gray-500">{formatWatWindow(m.startsAt, m.endsAt)}</p>
                </div>
                {m.signedInAt ? (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap">Signed in {formatWatDateTime(m.signedInAt).split(", ").pop()}</span>
                ) : m.isOpen ? (
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-full">Open</span>
                ) : (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Closed</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
