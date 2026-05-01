import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Notifications() {
  const { data: notifications, refetch } = useListNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const { toast } = useToast();

  const handleMarkRead = async (id: number) => {
    try {
      await markReadMutation.mutateAsync({ id, data: {} });
      refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync({ data: {} });
      refetch();
    } catch (e) {
      toast({ variant: "destructive", title: "Action failed" });
    }
  };

  const getIcon = (type: string) => {
    if (type.includes('emergency') || type.includes('alert')) return <AlertTriangle className="w-5 h-5 text-destructive" />;
    if (type.includes('success')) return <CheckCircle className="w-5 h-5 text-success" />;
    return <Info className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
          <Bell className="w-8 h-8" />
          Notifications
          {notifications?.unreadCount ? (
            <span className="bg-destructive text-white text-sm px-2 py-0.5 rounded-full">
              {notifications.unreadCount} new
            </span>
          ) : null}
        </h1>
        {notifications?.unreadCount ? (
          <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
            Mark all read
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        {notifications?.data?.map(notif => (
          <Card key={notif.id} className={notif.readStatus ? "opacity-70 bg-muted/30" : "border-primary/20 bg-primary/5"}>
            <CardContent className="p-4 flex gap-4">
              <div className="mt-1">{getIcon(notif.type)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold">{notif.title}</h4>
                  <span className="text-xs text-muted-foreground">{format(new Date(notif.createdAt), 'MMM d, h:mm a')}</span>
                </div>
                <p className="text-sm mt-1 text-muted-foreground">{notif.message}</p>
              </div>
              {!notif.readStatus && (
                <Button variant="ghost" size="sm" onClick={() => handleMarkRead(notif.id)} disabled={markReadMutation.isPending}>
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {notifications?.data?.length === 0 && (
          <div className="text-center p-12 text-muted-foreground border rounded-lg border-dashed">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted" />
            No notifications yet
          </div>
        )}
      </div>
    </div>
  );
}
