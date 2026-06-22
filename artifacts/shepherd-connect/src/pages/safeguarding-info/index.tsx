import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Camera, MapPin, Phone, Users, ClipboardList, Heart, Lock,
} from "lucide-react";

type AckStatus = { acknowledged: boolean; acknowledgedAt: string | null; policyVersion: string };

const SECTIONS = [
  {
    icon: ShieldCheck,
    title: "Safeguarding Policy",
    color: "#1e3a8a",
    content: `Shepherd Connect is committed to the safety, wellbeing and protection of every child in our care. Our safeguarding policy is built on the principle that the welfare of the child is paramount.

All volunteers and teachers have been DBS-checked and have completed safeguarding training. Any concern about a child's welfare will be taken seriously and acted upon immediately in accordance with our duty of care and relevant legislation.

Safeguarding Lead: Junior Church Leadership Team
Escalation: Church Safeguarding Officer → Senior Pastor → External Authorities (where required)`,
  },
  {
    icon: ClipboardList,
    title: "Parent Code of Conduct",
    color: "#7c3aed",
    content: `As a parent or guardian attending RCCG City of David Junior Church, we ask that you:

• Treat all children, volunteers and staff with respect at all times
• Ensure your child is dropped off and collected punctually at the designated area
• Inform the team of any medical conditions, allergies or specific needs your child has
• Provide accurate and up-to-date emergency contact information
• Notify the team immediately if collection arrangements change
• Refrain from entering the classroom without prior authorisation
• Report any concerns to a team member or through the in-app concerns portal`,
  },
  {
    icon: Heart,
    title: "Child Behaviour Expectations",
    color: "#059669",
    content: `We want every child to feel safe, included and celebrated. We expect children to:

• Treat teachers, volunteers and fellow children with kindness and respect
• Follow instructions from teachers and volunteers
• Stay within designated areas during the session
• Report any concerns or discomfort to a teacher immediately

Should a child exhibit persistent disruptive behaviour, parents will be contacted by a team leader. In serious cases, a formal behaviour plan may be put in place in partnership with the parent.`,
  },
  {
    icon: MapPin,
    title: "Drop-Off & Pick-Up Procedures",
    color: "#d97706",
    content: `Drop-Off:
• Children should be signed in at the check-in kiosk by their parent or guardian
• A digital check-in record and timestamp is created at drop-off
• Do not leave your child without completing check-in

Pick-Up:
• Children will only be released to the registered parent/guardian or an approved delegate
• Delegates must be pre-registered in the app and verified using a one-time passcode (OTP)
• If collection arrangements change on the day, please notify the team immediately
• Uncollected children will remain supervised and the registered parent will be contacted`,
  },
  {
    icon: Camera,
    title: "Photography Guidelines",
    color: "#dc2626",
    content: `Protecting children's privacy is a priority. The following rules apply to all photography and filming within Junior Church:

• No personal photography or filming of children is permitted during sessions without explicit prior consent
• Official photography for church records is only conducted by designated team members
• Images of children will never be shared on public social media without written parental consent
• Any parent who wishes to photograph their own child must do so outside the session area
• Breaches of this policy will be treated as a safeguarding matter`,
  },
  {
    icon: AlertTriangle,
    title: "Emergency Procedures",
    color: "#ea580c",
    content: `In the event of an emergency:

Fire / Evacuation:
• Teachers will lead children to the designated assembly point immediately
• Do not re-enter the building until the all-clear is given by leadership
• Parents will be notified via the app emergency notification system

Medical Emergency:
• First aiders will be called immediately
• Emergency services will be contacted if required
• Parents will be notified as soon as it is safe to do so

Missing Child:
• An immediate search of the premises will be conducted
• All exits will be secured
• Parents and security will be contacted without delay`,
  },
  {
    icon: Phone,
    title: "Reporting Contacts",
    color: "#0891b2",
    content: `If you have a safeguarding concern, complaint or feedback, please use the in-app "Submit a Concern" feature. Your submission will receive a unique reference number and will be tracked through to resolution.

For urgent safeguarding matters, please speak directly with a team leader or contact the Church Safeguarding Officer.

Emergency services: 199 (Police) / 112 (General Emergency)
NSPCC Helpline: 0808 800 5000

All concerns are treated with the utmost confidentiality and will be handled by trained safeguarding personnel.`,
  },
  {
    icon: Users,
    title: "Volunteer & Staff Checks",
    color: "#7c3aed",
    content: `All volunteers and staff working with children at RCCG City of David Junior Church are required to:

• Complete a Disclosure and Barring Service (DBS) check prior to commencing work
• Attend mandatory safeguarding training (renewed every 2 years)
• Sign and adhere to this safeguarding policy and code of conduct
• Report any concerns about children or colleagues without delay

Volunteer compliance is monitored by the leadership team. Any volunteer whose DBS or training has lapsed will be suspended from working with children until compliance is restored.`,
  },
];

function PolicySection({ section, defaultOpen = false }: { section: typeof SECTIONS[0]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${section.color}15` }}>
          <Icon className="w-5 h-5" style={{ color: section.color }} />
        </div>
        <span className="flex-1 font-semibold text-gray-800 text-sm">{section.title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-50">
          <p className="text-sm text-gray-600 mt-4 whitespace-pre-line leading-relaxed">{section.content}</p>
        </div>
      )}
    </div>
  );
}

export default function SafeguardingInfo() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ackData, isLoading } = useQuery<AckStatus>({
    queryKey: ["safeguarding-ack"],
    queryFn: () => apiGet("/safeguarding-portal/ack"),
  });

  const ackMut = useMutation({
    mutationFn: () => apiPost<any>("/safeguarding-portal/ack", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safeguarding-ack"] });
      toast({ title: "✅ Acknowledged", description: "Thank you. Your acknowledgement has been recorded." });
    },
    onError: () => toast({ variant: "destructive", title: "Could not save acknowledgement. Please try again." }),
  });

  const acknowledged = ackData?.acknowledged ?? false;
  const acknowledgedAt = ackData?.acknowledgedAt
    ? new Date(ackData.acknowledgedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg"
        style={{ background: "linear-gradient(135deg,#172554 0%,#1e3a8a 60%,#1d4ed8 100%)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-5 h-5 text-amber-300" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">Safeguarding</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Parent Information Portal
          </h1>
          <p className="text-blue-200 text-sm mt-1">
            Please read each section carefully and acknowledge your understanding below.
          </p>
        </div>
      </div>

      {/* Acknowledgement banner */}
      {!isLoading && (
        <div className={`rounded-2xl p-4 flex items-start gap-3 border ${acknowledged ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
          {acknowledged
            ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />}
          <div className="flex-1">
            {acknowledged ? (
              <>
                <p className="text-sm font-bold text-green-800">You have acknowledged these policies</p>
                <p className="text-xs text-green-600 mt-0.5">Acknowledged on {acknowledgedAt} · Policy {ackData?.policyVersion}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-800">Acknowledgement required</p>
                <p className="text-xs text-amber-600 mt-0.5">Please read all sections below and click the acknowledge button at the bottom.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Policy sections */}
      {SECTIONS.map((s, i) => (
        <PolicySection key={s.title} section={s} defaultOpen={i === 0} />
      ))}

      {/* Acknowledge button */}
      {!isLoading && !acknowledged && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-3">
          <p className="text-sm text-blue-800 font-semibold">Electronic Acknowledgement</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            By clicking the button below, I confirm that I have read and understood the Shepherd Connect
            Safeguarding Policy, Parent Code of Conduct, and all related guidelines. I agree to adhere
            to these policies while my child participates in Junior Church.
          </p>
          <button
            onClick={() => ackMut.mutate()}
            disabled={ackMut.isPending}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-98 disabled:opacity-60"
            style={{ background: "#1e3a8a", color: "white" }}>
            {ackMut.isPending ? "Saving…" : "I Acknowledge & Agree to All Policies"}
          </button>
        </div>
      )}

      {!isLoading && acknowledged && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">All policies acknowledged</p>
            <p className="text-xs text-green-600 mt-0.5">Acknowledged on {acknowledgedAt}</p>
          </div>
        </div>
      )}
    </div>
  );
}
