import { useGetChild, useGetChildQrCode, useListAttendance, useListAppraisals } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Clock, Calendar, CheckSquare, Award, Phone, Shield, Stethoscope, Route, ArrowRight, Trash2, FileCheck } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import FaceEnrollment from "@/components/FaceEnrollment";
import { apiGet, apiDelete, apiPost } from "@/lib/api-call";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/hooks/use-toast";

const CONSENT_LABELS: Record<string, string> = {
  photo: "Photography & Video",
  medical_treatment: "Emergency Medical Treatment",
  trips: "Off-site Trips & Outings",
  social_media: "Social Media Sharing",
  emergency_contact: "Emergency Contact Authority",
};

function ConsentFormsSection({ childId, canEdit }: { childId: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: forms, isLoading } = useQuery({
    queryKey: ["consent-forms", childId],
    queryFn: () => apiGet<any[]>(`/children/${childId}/consent-forms`),
    enabled: !!childId,
  });

  const toggleMut = useMutation({
    mutationFn: ({ type, granted }: { type: string; granted: boolean }) =>
      apiPost(`/children/${childId}/consent-forms`, { type, granted }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consent-forms", childId] });
      toast({ title: "Consent updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update consent" }),
  });

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="w-5 h-5 text-blue-700" /> Consent Forms
        </CardTitle>
        <p className="text-xs text-gray-500 -mt-1">Parental consent status for this child</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : (
          <div className="space-y-2">
            {(forms || []).map((form: any) => (
              <div key={form.type}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  form.granted ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                }`}>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{CONSENT_LABELS[form.type] || form.type}</p>
                  {form.grantedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Granted {format(new Date(form.grantedAt), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    form.granted ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"
                  }`}>
                    {form.granted ? "Granted" : "Not granted"}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => toggleMut.mutate({ type: form.type, granted: !form.granted })}
                      disabled={toggleMut.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                        form.granted
                          ? "bg-red-100 text-red-700 hover:bg-red-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}>
                      {form.granted ? "Revoke" : "Grant"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClassJourneyTimeline({ childId }: { childId: number }) {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["class-assignments", childId],
    queryFn: () => apiGet<any[]>(`/class-assignments?childId=${childId}`),
    enabled: !!childId,
  });

  const sorted = [...(assignments || [])].sort(
    (a, b) => new Date(a.assignedAt || a.createdAt || 0).getTime() - new Date(b.assignedAt || b.createdAt || 0).getTime()
  );

  if (!isLoading && sorted.length === 0) return null;

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="w-5 h-5 text-blue-700" /> Class Journey
        </CardTitle>
        <p className="text-xs text-gray-500 -mt-1">Class progression history for this child</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-blue-100 to-transparent" />
            <div className="space-y-3">
              {sorted.map((a, i) => {
                const isLast = i === sorted.length - 1;
                return (
                  <div key={a.id} className="flex items-start gap-4 pl-10 relative">
                    <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      isLast ? "bg-blue-700 border-blue-700" : "bg-white border-blue-300"
                    }`} />
                    <div className={`flex-1 rounded-xl p-3 border ${isLast ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-100"}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${isLast ? "text-blue-900" : "text-gray-700"}`}>
                            {a.class?.name || `Class #${a.classId}`}
                          </span>
                          {isLast && <Badge className="bg-blue-700 text-white text-xs px-1.5 py-0">Current</Badge>}
                        </div>
                        <span className="text-xs text-gray-400">
                          {a.assignedAt || a.createdAt
                            ? format(new Date(a.assignedAt || a.createdAt), "MMM d, yyyy")
                            : "—"}
                        </span>
                      </div>
                      {a.notes && <p className="text-xs text-gray-500 mt-1">{a.notes}</p>}
                    </div>
                    {!isLast && (
                      <ArrowRight className="absolute left-[38px] top-[38px] h-3 w-3 text-blue-200 rotate-90" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChildProfile() {
  const { id } = useParams();
  const childId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: child, isLoading: childLoading } = useGetChild(childId, { query: { enabled: !!childId, queryKey: ["getChild", childId] } });
  const { data: qrData, isLoading: qrLoading } = useGetChildQrCode(childId, { query: { enabled: !!childId, queryKey: ["getChildQrCode", childId] } });
  const { data: attendance, isLoading: attLoading } = useListAttendance({ childId }, { query: { enabled: !!childId, queryKey: ["listAttendance", childId] } });
  const { data: appraisals, isLoading: appLoading } = useListAppraisals({ childId }, { query: { enabled: !!childId, queryKey: ["listAppraisals", childId] } });

  const { data: family } = useQuery({
    queryKey: ["family", child?.familyId],
    queryFn: () => apiGet<any>(`/families/${child?.familyId}`),
    enabled: !!child?.familyId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete<{ success: boolean }>(`/children/${childId}`),
    onSuccess: () => {
      toast({ title: "Child removed", description: "The child record has been permanently deleted." });
      // Navigate to family profile if we know it, otherwise families list
      if (child?.familyId) {
        const isParent = user?.role === "parent";
        setLocation(isParent ? "/my-family" : `/families/${child.familyId}`);
      } else {
        setLocation("/families");
      }
    },
    onError: () => toast({ variant: "destructive", title: "Delete failed", description: "Could not delete this child." }),
  });

  const canDelete = user && (
    ["super_admin", "admin"].includes(user.role) ||
    (user.role === "parent" && family && (family.parent1Id === user.id || family.parent2Id === user.id))
  );

  if (childLoading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!child) return <div>Child not found</div>;

  const totalSessions = (attendance || []).length;
  const pickedUpSessions = (attendance || []).filter((a: any) => a.status === "picked_up").length;
  const attendanceRate = totalSessions > 0 ? Math.round((pickedUpSessions / totalSessions) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Remove Child
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <p className="text-sm text-gray-700">
              This will permanently remove <strong>{child.firstName} {child.lastName}</strong> and all
              their attendance, appraisals, and delegate records. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteMutation.isPending ? "Removing…" : "Yes, Remove Child"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {child.allergies && (
        <div className="bg-destructive text-destructive-foreground p-4 rounded-xl flex items-center gap-3 font-bold shadow-lg animate-in slide-in-from-top-4">
          <AlertTriangle className="h-6 w-6 flex-shrink-0" />
          ALLERGY ALERT: {child.allergies}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl" style={{ fontFamily: "'Playfair Display', serif" }}>{child.firstName} {child.lastName}</CardTitle>
                <CardDescription className="text-base mt-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {format(new Date(child.dob), "MMM dd, yyyy")} (Age {child.age})
                </CardDescription>
              </div>
              <div className="text-right space-y-2">
                {child.currentClass ? (
                  <Badge className="text-sm py-1 px-3">{child.currentClass.name}</Badge>
                ) : (
                  <Badge variant="secondary">Unassigned</Badge>
                )}
                {(child as any).servicePreference && (
                  <div className="text-xs font-semibold rounded-full px-3 py-1 inline-block"
                    style={{ background: "#fef3c7", color: "#92400e" }}>
                    {(child as any).servicePreference === "7am" ? "1st Service · 7:00 AM"
                      : (child as any).servicePreference === "10:30am" ? "2nd Service · 10:30 AM"
                      : "Both Services"}
                  </div>
                )}
                <div><Link href={`/families/${child.familyId}`} className="text-sm text-primary hover:underline">View Family</Link></div>
                {canDelete && (
                  <div>
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Child
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-800">{totalSessions}</p>
                <p className="text-xs text-blue-600 font-medium mt-0.5">Total Sessions</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{attendanceRate}%</p>
                <p className="text-xs text-green-600 font-medium mt-0.5">Pickup Rate</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{(appraisals || []).length}</p>
                <p className="text-xs text-amber-600 font-medium mt-0.5">Appraisals</p>
              </div>
            </div>

            <FaceEnrollment
              childId={childId}
              childName={`${child.firstName} ${child.lastName}`}
              isEnrolled={!!child.faceDescriptorJson}
              onUpdate={() => window.location.reload()}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-center text-base">Family Check-In QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-4 bg-white">
            {qrLoading ? <Skeleton className="h-48 w-48" /> : qrData?.qrCode ? (
              <div className="p-3 border-2 border-gray-100 rounded-xl bg-white">
                <QRCodeSVG value={qrData.qrCode} size={160} level="H" includeMargin
                  imageSettings={{ src: "/rccg-logo-new.png", x: undefined, y: undefined, height: 28, width: 28, excavate: true }} />
              </div>
            ) : null}
            <p className="mt-3 text-center text-sm font-medium text-slate-800">
              Family Code:<br />
              <span className="text-lg tracking-widest font-mono" style={{ color: "#1e3a8a" }}>{qrData?.familyCode}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Medical Card */}
      {(child.allergies || child.medicalNotes || family?.emergencyContactName) && (
        <Card className="rounded-2xl border-red-100 bg-red-50/30 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-800 text-base">
              <Stethoscope className="w-5 h-5" /> Medical & Emergency Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            {child.allergies && (
              <div className="bg-red-100 rounded-xl p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-bold uppercase tracking-wide text-red-700">Allergies</span>
                </div>
                <p className="text-sm text-red-800 font-medium">{child.allergies}</p>
              </div>
            )}
            {child.medicalNotes && (
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Medical Notes</span>
                </div>
                <p className="text-sm text-gray-700">{child.medicalNotes}</p>
              </div>
            )}
            {family?.emergencyContactName && (
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Emergency Contact</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">{family.emergencyContactName}</p>
                {family.emergencyContactPhone && <p className="text-sm text-blue-700 font-mono mt-0.5">{family.emergencyContactPhone}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consent Forms */}
      <ConsentFormsSection
        childId={childId}
        canEdit={!!(user && (["super_admin", "admin"].includes(user.role) ||
          (user.role === "parent" && family && (family.parent1Id === user.id || family.parent2Id === user.id))))}
      />

      {/* Class Journey Timeline */}
      <ClassJourneyTimeline childId={childId} />

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5" /> Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {attLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {(attendance || []).slice(0, 8).map((record: any) => (
                  <div key={record.id} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div>
                      <div className="font-medium text-sm">{format(new Date(record.serviceDate), "MMM dd, yyyy")}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {record.serviceSlot}</div>
                    </div>
                    <Badge variant={record.status === "picked_up" ? "outline" : "default"} className="text-xs">
                      {record.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
                {!attendance?.length && <p className="text-muted-foreground text-sm text-center py-4">No attendance records.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="w-5 h-5" /> Appraisals</CardTitle>
          </CardHeader>
          <CardContent>
            {appLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-3">
                {(appraisals || []).map((appraisal: any) => (
                  <div key={appraisal.id} className="p-3 border rounded-xl space-y-2 bg-muted/10">
                    <div className="font-medium text-sm">{format(new Date(appraisal.serviceDate), "MMM dd, yyyy")}</div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <span className="text-muted-foreground">Participation:</span>
                      <span className="font-medium capitalize">{appraisal.participationLevel?.replace("_", " ")}</span>
                      <span className="text-muted-foreground">Scripture:</span>
                      <span className="font-medium capitalize">{appraisal.scriptureEngagement?.replace("_", " ")}</span>
                      <span className="text-muted-foreground">Social:</span>
                      <span className="font-medium capitalize">{appraisal.socialInteraction?.replace("_", " ")}</span>
                    </div>
                    {appraisal.milestoneNote && (
                      <div className="mt-2 pt-2 border-t text-xs">
                        <span className="font-semibold text-accent">Milestone: </span>{appraisal.milestoneNote}
                      </div>
                    )}
                  </div>
                ))}
                {!appraisals?.length && <p className="text-muted-foreground text-sm text-center py-4">No appraisals yet.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
