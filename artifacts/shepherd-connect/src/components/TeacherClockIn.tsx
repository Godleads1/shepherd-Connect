import { Clock, QrCode } from "lucide-react";
import { useLocation } from "wouter";

export function TeacherClockIn() {
  const [, navigate] = useLocation();
  const dateLabel = new Intl.DateTimeFormat("en-NG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date());

  return (
    <div className="rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center gap-2 bg-blue-50">
        <Clock className="w-4 h-4" style={{ color: "#1e3a8a" }} />
        <span className="text-sm font-bold text-gray-800">Service Attendance</span>
      </div>
      <div className="px-4 py-4 bg-white flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">{dateLabel}</p>
          <p className="text-xs text-gray-500 mt-1">
            Scan the service QR, then choose First or Second Service.
          </p>
        </div>
        <button
          onClick={() => navigate("/scan")}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-900 text-white active:scale-95"
        >
          <QrCode className="w-4 h-4" />
          Scan QR
        </button>
      </div>
    </div>
  );
}
