import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { Bell, CheckCircle, Info, AlertTriangle, Check, CheckCheck } from "lucide-react";
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

  const getIconAndColor = (type: string) => {
    if (type.includes('emergency') || type.includes('alert')) return { icon: <AlertTriangle className="w-5 h-5 text-red-600" />, bg: "bg-red-100" };
    if (type.includes('success')) return { icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: "bg-green-100" };
    return { icon: <Info className="w-5 h-5 text-blue-600" />, bg: "bg-blue-100" };
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-4">
      <div className="flex justify-between items-end border-b border-gray-100 pb-5 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            <div className="relative">
              <Bell className="w-8 h-8 text-blue-900" />
              {notifications?.unreadCount ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white"></span>
              ) : null}
            </div>
            Notifications
          </h1>
          <p className="text-gray-500 mt-2 text-sm">Stay updated with your family and classes.</p>
        </div>
        
        {notifications?.unreadCount ? (
          <button 
            onClick={handleMarkAllRead} 
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {notifications?.data?.map(notif => {
          const { icon, bg } = getIconAndColor(notif.type);
          return (
            <div 
              key={notif.id} 
              className={`p-5 rounded-2xl transition-all duration-300 flex gap-4 ${
                notif.readStatus 
                  ? "bg-white border border-gray-100 opacity-70" 
                  : "bg-white border-l-4 border-l-[#1a237e] border border-gray-100 shadow-sm"
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                {icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-bold text-base leading-tight ${notif.readStatus ? "text-gray-700" : "text-gray-900"}`}>
                    {notif.title}
                  </h4>
                  <span className="text-xs font-medium text-gray-400 whitespace-nowrap ml-4">
                    {format(new Date(notif.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className={`text-sm ${notif.readStatus ? "text-gray-500" : "text-gray-700 font-medium"}`}>
                  {notif.message}
                </p>
              </div>
              
              {!notif.readStatus && (
                <button 
                  className="w-8 h-8 rounded-full bg-gray-50 hover:bg-green-50 text-gray-400 hover:text-green-600 flex items-center justify-center transition-colors flex-shrink-0"
                  onClick={() => handleMarkRead(notif.id)} 
                  disabled={markReadMutation.isPending}
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
        
        {notifications?.data?.length === 0 && (
          <div className="text-center py-16 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">All Caught Up</h3>
            <p className="text-gray-500 text-sm">You have no notifications right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
