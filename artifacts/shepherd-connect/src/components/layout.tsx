import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLogout, useListNotifications } from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, Baby, School, ClipboardCheck, CheckSquare,
  LogOut, Menu, Bell, MessageSquare, AlertTriangle, UserCog, FileText,
  Clock, ShieldCheck, QrCode, Home, Grid3x3, X, ChevronRight,
} from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout: localLogout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logoutMutation = useLogout();
  const { data: notifData } = useListNotifications({ unreadOnly: true, limit: 1 });
  const unreadCount = notifData?.unreadCount ?? 0;

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } finally { localLogout(); }
  };

  const role = user?.role || "parent";

  const getNavItems = () => {
    const items: Array<{ href: string; label: string; icon: React.ElementType }> = [];
    if (["super_admin", "admin"].includes(role)) {
      items.push({ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard });
      items.push({ href: "/families", label: "Families", icon: Users });
      items.push({ href: "/children", label: "Children", icon: Baby });
      items.push({ href: "/classes", label: "Classes", icon: School });
      items.push({ href: "/class-assignments", label: "Assignments", icon: ClipboardCheck });
      items.push({ href: "/teachers", label: "Teachers", icon: UserCog });
      items.push({ href: "/teacher-allocations", label: "Allocations", icon: Clock });
      items.push({ href: "/attendance", label: "Attendance", icon: CheckSquare });
      items.push({ href: "/emergencies", label: "Emergencies", icon: AlertTriangle });
      items.push({ href: "/audit", label: "Audit Logs", icon: FileText });
      if (role === "super_admin") items.push({ href: "/users", label: "Users", icon: ShieldCheck });
    } else if (role === "parent") {
      items.push({ href: "/my-family", label: "My Family", icon: Home });
      items.push({ href: "/my-children", label: "My Children", icon: Baby });
      items.push({ href: "/pickup-delegates", label: "Delegates", icon: UserCog });
      items.push({ href: "/feedback", label: "Feedback", icon: MessageSquare });
    } else if (role === "teacher") {
      items.push({ href: "/my-class", label: "My Class", icon: School });
      items.push({ href: "/attendance", label: "Attendance", icon: CheckSquare });
      items.push({ href: "/appraisals", label: "Appraisals", icon: FileText });
    } else if (role === "attendant") {
      items.push({ href: "/checkin", label: "Check-in", icon: ClipboardCheck });
      items.push({ href: "/checkout", label: "Check-out", icon: CheckSquare });
    }
    items.push({ href: "/notifications", label: "Notifications", icon: Bell });
    return items;
  };

  const navItems = getNavItems();

  // Bottom nav tabs (mobile) — up to 4 items + center QR
  const getBottomTabs = () => {
    if (role === "parent") return [
      { href: "/my-family", label: "Home", icon: Home },
      { href: "/my-children", label: "Family", icon: Users },
      { href: "/notifications", label: "Alerts", icon: Bell, badge: unreadCount },
      { href: "/pickup-delegates", label: "More", icon: Grid3x3 },
    ];
    if (role === "teacher") return [
      { href: "/my-class", label: "Class", icon: School },
      { href: "/attendance", label: "Attend", icon: CheckSquare },
      { href: "/notifications", label: "Alerts", icon: Bell, badge: unreadCount },
      { href: "/appraisals", label: "Reports", icon: FileText },
    ];
    if (role === "attendant") return [
      { href: "/checkin", label: "Check-in", icon: ClipboardCheck },
      { href: "/checkout", label: "Check-out", icon: CheckSquare },
      { href: "/notifications", label: "Alerts", icon: Bell, badge: unreadCount },
      { href: "/checkin", label: "QR", icon: QrCode },
    ];
    // admin / super_admin
    return [
      { href: "/dashboard", label: "Home", icon: LayoutDashboard },
      { href: "/families", label: "Families", icon: Users },
      { href: "/notifications", label: "Alerts", icon: Bell, badge: unreadCount },
      { href: "/emergencies", label: "More", icon: Grid3x3 },
    ];
  };
  const bottomTabs = getBottomTabs();

  const isActive = (href: string) => location === href;

  return (
    <div className="flex min-h-screen w-full bg-background">

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-64 fixed left-0 top-0 bottom-0 z-40"
        style={{ background: "linear-gradient(180deg, #172554 0%, #1e3a8a 100%)" }}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-full bg-white p-0.5 shadow-md flex-shrink-0">
            <img src="/rccg-logo.png" alt="RCCG" className="w-full h-full rounded-full object-cover" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Shepherd Connect</p>
            <p className="text-amber-400 text-[10px] font-medium tracking-wide">City of David</p>
          </div>
        </div>

        {/* User chip */}
        <div className="mx-4 mt-4 mb-2 px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center font-bold text-blue-900 text-sm flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-white/50 text-[10px] capitalize">{role.replace("_", " ")}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group"
                  style={active ? {
                    background: "rgba(245,158,11,0.20)",
                    color: "#f59e0b",
                  } : {
                    color: "rgba(255,255,255,0.75)",
                  }}
                  onMouseOver={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseOut={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/notifications" && unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                  {active && <ChevronRight className="w-3 h-3 text-amber-400" />}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Overlay Sidebar ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 flex flex-col"
            style={{ background: "linear-gradient(180deg, #172554 0%, #1e3a8a 100%)" }}
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white p-0.5 shadow-md">
                  <img src="/rccg-logo.png" alt="RCCG" className="w-full h-full rounded-full object-cover" />
                </div>
                <p className="text-white font-semibold text-sm">Shepherd Connect</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer"
                      style={active ? { background: "rgba(245,158,11,0.20)", color: "#f59e0b" } : { color: "rgba(255,255,255,0.75)" }}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                      {item.href === "/notifications" && unreadCount > 0 && (
                        <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-all">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Right side: header + content + bottom nav ── */}
      <div className="flex flex-col flex-1 md:ml-64 min-h-screen">

        {/* Top Header */}
        <header
          className="sticky top-0 z-30 flex items-center h-14 px-4 gap-3"
          style={{ background: "linear-gradient(90deg, #1e3a8a, #1d4ed8)" }}
        >
          {/* Mobile hamburger */}
          <button className="md:hidden text-white/80 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo (mobile only) */}
          <div className="md:hidden flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full bg-white p-0.5 shadow-sm">
              <img src="/rccg-logo.png" alt="RCCG" className="w-full h-full rounded-full object-cover" />
            </div>
            <span className="text-white font-semibold text-sm">Shepherd Connect</span>
          </div>

          {/* Desktop page title area */}
          <div className="hidden md:flex flex-1 items-center">
            <span className="text-white/70 text-sm">
              Welcome back, <span className="text-white font-medium">{user?.firstName}</span>
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link href="/notifications">
              <button className="relative w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                <Bell className="w-4 h-4 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>
            <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center font-bold text-blue-900 text-xs shadow-md">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-end pb-safe"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(30,58,138,0.10)" }}
        >
          {/* Render 2 left tabs */}
          {bottomTabs.slice(0, 2).map(tab => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} className="flex-1">
                <span className="flex flex-col items-center gap-1 py-2.5 transition-all cursor-pointer">
                  <div className="relative">
                    <Icon className="w-5 h-5" style={{ color: active ? "#1e3a8a" : "#94a3b8" }} />
                    {tab.badge && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                        {tab.badge > 9 ? "9+" : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: active ? "#1e3a8a" : "#94a3b8" }}>
                    {tab.label}
                  </span>
                </span>
              </Link>
            );
          })}

          {/* Center QR button */}
          <div className="flex-1 flex justify-center items-center pb-1">
            <Link href={role === "attendant" ? "/checkin" : role === "parent" ? "/my-family" : "/checkin"}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", boxShadow: "0 4px 16px rgba(245,158,11,0.5)" }}
              >
                <QrCode className="w-6 h-6 text-blue-900" />
              </div>
            </Link>
          </div>

          {/* Render 2 right tabs */}
          {bottomTabs.slice(2, 4).map(tab => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href + "-right"} href={tab.href} className="flex-1">
                <span className="flex flex-col items-center gap-1 py-2.5 transition-all cursor-pointer">
                  <div className="relative">
                    <Icon className="w-5 h-5" style={{ color: active ? "#1e3a8a" : "#94a3b8" }} />
                    {tab.badge && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                        {tab.badge > 9 ? "9+" : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: active ? "#1e3a8a" : "#94a3b8" }}>
                    {tab.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
