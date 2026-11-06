import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateMeetingForm, watInputToIso } from "@/lib/meeting-attendance";
import type { MeetingInput } from "@workspace/api-client-react";

interface Props {
  idPrefix: string;
  initial?: { title: string; startsAt: string; endsAt: string };
  submitLabel: string;
  pending: boolean;
  note?: string;
  onSubmit: (input: MeetingInput) => void;
  onCancel?: () => void;
}

export function MeetingForm({ idPrefix, initial, submitLabel, pending, note, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? "");
  const [touched, setTouched] = useState(false);
  const error = validateMeetingForm(title, startsAt, endsAt);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (error) return;
    onSubmit({ title: title.trim(), startsAt: watInputToIso(startsAt)!, endsAt: watInputToIso(endsAt)! });
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <Label htmlFor={`${idPrefix}-title`} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meeting title</Label>
        <Input id={`${idPrefix}-title`} value={title} maxLength={120} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Teachers' monthly planning" data-testid={`input-${idPrefix}-title`} />
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-start`} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Starts (Lagos time, WAT)</Label>
          <Input id={`${idPrefix}-start`} type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} data-testid={`input-${idPrefix}-start`} />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-end`} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ends (Lagos time, WAT)</Label>
          <Input id={`${idPrefix}-end`} type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} data-testid={`input-${idPrefix}-end`} />
        </div>
      </div>
      {note && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{note}</p>}
      {touched && error && <p className="text-xs text-red-600" role="alert" data-testid={`text-${idPrefix}-error`}>{error}</p>}
      <div className="flex gap-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} data-testid={`button-${idPrefix}-cancel`}>Cancel</Button>}
        <Button type="submit" disabled={pending} className="bg-blue-800 hover:bg-blue-900" data-testid={`button-${idPrefix}-submit`}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
