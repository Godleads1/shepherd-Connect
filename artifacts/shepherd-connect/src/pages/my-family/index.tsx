import { useGetMyFamily } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { QrCode, FileText, Users, MapPin, ChevronRight, ShieldCheck, Star } from "lucide-react";
import { useAuth } from "@/contexts/auth";

function ChildCard({ child }: { child: any }) {
  const statusColor = child.currentClass ? "#16a34a" : "#f59e0b";
  const statusBg = child.currentClass ? "#dcfce7" : "#fef3c7";
  const statusText = child.currentClass ? "In Class" : "Unassigned";
  const borderColor = child.currentClass ? "#16a34a" : "#f59e0b";
  const hasAllergy = !!child.allergies;

  return (
    <div
      className="bg-white rounded-2xl p-5 transition-all duration-300 border-l-4"
      style={{
        boxShadow: "0 4px 6px -1px rgba(30,58,138,.10), 0 2px 4px -2px rgba(30,58,138,.10)",
        borderLeftColor: borderColor,
      }}
      onMouseOver={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 25px -5px rgba(30,58,138,.15), 0 8px 10px -6px rgba(30,58,138,.10)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseOut={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 6px -1px rgba(30,58,138,.10), 0 2px 4px -2px rgba(30,58,138,.10)";
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {/* Allergy alert */}
      {hasAllergy && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <span className="text-red-500">⚠</span> Allergy: {child.allergies}
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}
          >
            {child.firstName[0]}{child.lastName[0]}
          </div>
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
            style={{ background: statusColor }}
          >
            {child.currentClass ? (
              <span className="text-white text-[8px]">✓</span>
            ) : (
              <span className="text-white text-[8px]">?</span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 text-base leading-tight">
                {child.firstName} {child.lastName}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">Age {child.age}</p>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ background: statusBg, color: statusColor }}
            >
              {statusText}
            </span>
          </div>

          {/* Class info */}
          {child.currentClass && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#1e3a8a] flex-shrink-0" />
              <span className="font-medium">{child.currentClass.name}</span>
              <span className="text-gray-300">·</span>
              <span>{child.currentClass.roomLocation}</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Link href={`/children/${child.id}`} className="flex-1">
              <button
                className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                style={{ background: "#1e3a8a", color: "white" }}
              >
                <QrCode className="w-3.5 h-3.5" /> Show QR
              </button>
            </Link>
            <Link href={`/children/${child.id}`} className="flex-1">
              <button
                className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all hover:bg-amber-50"
                style={{ background: "#fefce8", borderColor: "#f59e0b", color: "#172554" }}
              >
                <FileText className="w-3.5 h-3.5" /> Report
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MyFamily() {
  const { user } = useAuth();
  const { data: family, isLoading } = useGetMyFamily();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const children = family?.children || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #172554 0%, #1e3a8a 60%, #1d4ed8 100%)" }}
      >
        {/* Decorative circle */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -right-4 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative z-10">
          <p className="text-white/70 text-sm">{greeting},</p>
          <h1
            className="text-2xl font-bold text-white mt-0.5"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-white/60 text-xs mt-1">Your family is covered by grace</p>

          <div className="flex items-center gap-3 mt-4">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(245,158,11,0.25)", color: "#fbbf24" }}
            >
              {children.length} {children.length === 1 ? "Child" : "Children"}
            </span>
            {family?.familyCode && (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}
              >
                {family.familyCode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/pickup-delegates", label: "Delegates", icon: ShieldCheck, color: "#1e3a8a" },
          { href: "/feedback", label: "Feedback", icon: Star, color: "#f59e0b" },
          { href: "/notifications", label: "Alerts", icon: Users, color: "#16a34a" },
        ].map(action => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <div
                className="rounded-xl p-4 text-center cursor-pointer transition-all hover:scale-105 bg-white"
                style={{ boxShadow: "0 2px 8px rgba(30,58,138,.08)" }}
              >
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                  style={{ background: action.color + "1a" }}
                >
                  <Icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <p className="text-xs font-semibold text-gray-700">{action.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Children */}
      <div>
        <h2
          className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          My Children
          <span className="text-sm font-normal text-gray-400">({children.length})</span>
        </h2>
        {children.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No children registered yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {children.map((child: any) => <ChildCard key={child.id} child={child} />)}
          </div>
        )}
      </div>
    </div>
  );
}
