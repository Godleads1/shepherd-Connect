import { useGetChild, useGetChildQrCode, useListAttendance, useListAppraisals } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Calendar, CheckSquare, Award, Activity, Phone, Shield, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import FaceEnrollment from "@/components/FaceEnrollment";
import { apiGet } from "@/lib/api-call";

export default function ChildProfile() {
  const { id } = useParams();
  const childId = parseInt(id || "0", 10);

  const { data: child, isLoading: childLoading } = useGetChild(childId, { query: { enabled: !!childId, queryKey: ["getChild", childId] } });
  const { data: qrData, isLoading: qrLoading } = useGetChildQrCode(childId, { query: { enabled: !!childId, queryKey: ["getChildQrCode", childId] } });
  const { data: attendance, isLoading: attLoading } = useListAttendance({ childId }, { query: { enabled: !!childId, queryKey: ["listAttendance", childId] } });
  const { data: appraisals, isLoading: appLoading } = useListAppraisals({ childId }, { query: { enabled: !!childId, queryKey: ["listAppraisals", childId] } });

  const { data: family } = useQuery({
    queryKey: ["family", child?.familyId],
    queryFn: () => apiGet<any>(`/families/${child?.familyId}`),
    enabled: !!child?.familyId,
  });

  if (childLoading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!child) return <div>Child not found</div>;

  const totalSessions = (attendance || []).length;
  const pickedUpSessions = (attendance || []).filter((a: any) => a.status === "picked_up").length;
  const attendanceRate = totalSessions > 0 ? Math.round((pickedUpSessions / totalSessions) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
                <div><Link href={`/families/${child.familyId}`} className="text-sm text-primary hover:underline">View Family</Link></div>
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
