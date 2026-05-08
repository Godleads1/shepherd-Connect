import { useGetChild, useGetChildQrCode, useListAttendance, useListAppraisals } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Calendar, CheckSquare, Award } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import FaceEnrollment from "@/components/FaceEnrollment";

export default function ChildProfile() {
  const { id } = useParams();
  const childId = parseInt(id || "0", 10);

  const { data: child, isLoading: childLoading } = useGetChild(childId, { query: { enabled: !!childId, queryKey: ['getChild', childId] } });
  const { data: qrData, isLoading: qrLoading } = useGetChildQrCode(childId, { query: { enabled: !!childId, queryKey: ['getChildQrCode', childId] } });
  const { data: attendance, isLoading: attLoading } = useListAttendance({ childId }, { query: { enabled: !!childId, queryKey: ['listAttendance', childId] } });
  const { data: appraisals, isLoading: appLoading } = useListAppraisals({ childId }, { query: { enabled: !!childId, queryKey: ['listAppraisals', childId] } });

  if (childLoading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!child) return <div>Child not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {child.allergies && (
        <div className="bg-destructive text-destructive-foreground p-4 rounded-lg flex items-center gap-3 font-bold shadow-lg animate-in slide-in-from-top-4">
          <AlertTriangle className="h-6 w-6" />
          ALLERGY ALERT: {child.allergies}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl">{child.firstName} {child.lastName}</CardTitle>
                <CardDescription className="text-base mt-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {format(new Date(child.dob), 'MMM dd, yyyy')} (Age {child.age})
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
          <CardContent className="space-y-6">
            {child.medicalNotes && (
              <div className="p-4 bg-muted/30 border rounded-lg">
                <h4 className="font-semibold mb-1 text-sm text-muted-foreground uppercase">Medical Notes</h4>
                <p>{child.medicalNotes}</p>
              </div>
            )}
            <FaceEnrollment
              childId={childId}
              childName={`${child.firstName} ${child.lastName}`}
              isEnrolled={!!child.faceDescriptorJson}
              onUpdate={() => window.location.reload()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Family Check-In QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 bg-white">
            {qrLoading ? <Skeleton className="h-48 w-48" /> : qrData?.qrCode ? (
              <div className="p-3 border-2 border-gray-100 rounded-xl bg-white">
                <QRCodeSVG
                  value={qrData.qrCode}
                  size={180}
                  level="H"
                  includeMargin
                  imageSettings={{
                    src: "/rccg-logo-new.png",
                    x: undefined, y: undefined,
                    height: 32, width: 32,
                    excavate: true,
                  }}
                />
              </div>
            ) : null}
            <p className="mt-4 text-center text-sm font-medium text-slate-800">
              Family Code: <br/>
              <span className="text-xl tracking-widest font-mono" style={{ color: "#1e3a8a" }}>{qrData?.familyCode}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckSquare className="w-5 h-5" /> Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            {attLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4">
                {(attendance || []).slice(0, 5).map((record: any) => (
                  <div key={record.id} className="flex justify-between items-center p-3 border-b last:border-0">
                    <div>
                      <div className="font-medium">{format(new Date(record.serviceDate), 'MMM dd, yyyy')}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {record.serviceSlot}
                      </div>
                    </div>
                    <Badge variant={record.status === 'picked_up' ? 'outline' : 'default'}>{record.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
                {!attendance?.length && <p className="text-muted-foreground">No attendance records.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="w-5 h-5" /> Appraisals</CardTitle>
          </CardHeader>
          <CardContent>
            {appLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-4">
                {(appraisals || []).map((appraisal: any) => (
                  <div key={appraisal.id} className="p-3 border rounded-lg space-y-2 bg-muted/10">
                    <div className="font-medium">{format(new Date(appraisal.serviceDate), 'MMM dd, yyyy')}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Participation:</div>
                      <div className="font-medium capitalize">{appraisal.participationLevel.replace('_', ' ')}</div>
                      <div className="text-muted-foreground">Scripture:</div>
                      <div className="font-medium capitalize">{appraisal.scriptureEngagement.replace('_', ' ')}</div>
                      <div className="text-muted-foreground">Social:</div>
                      <div className="font-medium capitalize">{appraisal.socialInteraction.replace('_', ' ')}</div>
                    </div>
                    {appraisal.milestoneNote && (
                      <div className="mt-2 pt-2 border-t text-sm">
                        <span className="font-semibold text-accent">Milestone: </span>
                        {appraisal.milestoneNote}
                      </div>
                    )}
                  </div>
                ))}
                {!appraisals?.length && <p className="text-muted-foreground">No appraisals yet.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
