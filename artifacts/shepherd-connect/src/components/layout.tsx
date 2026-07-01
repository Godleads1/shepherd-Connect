import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLogout } from "@workspace/api-client-react";
import { useLang, LANGUAGES, LangCode } from "@/contexts/language";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";
import {
  LayoutDashboard, Users, Baby, School, ClipboardCheck, CheckSquare, CheckCircle2,
  LogOut, Menu, Bell, MessageSquare, AlertTriangle, UserCog, FileText, Star,
  Clock, ShieldCheck, QrCode, Home, Grid3x3, X, ChevronRight, ChevronDown, Globe, MessageSquareWarning, ShieldAlert,
  BarChart3, UserCircle, Search, ListOrdered, CalendarClock, BookOpen, WifiOff,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-call";

function SidebarLangSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === lang)!;

  return (
    <div className="relative px-4 pb-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.70)" }}
      >
        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">{current.flag} {current.nativeName}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "", display: "inline-block", transition: "transform 0.2s", fontSize: 10 }}>▲</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-4 right-4 mb-1 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{ background: "rgba(15,23,42,0.97)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-left transition-all"
              style={
                lang === l.code
                  ? { background: "rgba(255,255,255,0.15)", color: "#ffffff" }
                  : { color: "rgba(255,255,255,0.75)" }
              }
              onMouseOver={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseOut={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              <span className="text-sm">{l.flag}</span>
              <span className="flex-1">{l.nativeName}</span>
              {lang === l.code && <span className="text-white text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({ data, onSelect }: { data: any; onSelect: (href: string) => void }) {
  const total = (data?.children?.length || 0) + (data?.families?.length || 0) + (data?.users?.length || 0);
  if (total === 0) return <p className="text-xs text-gray-400 text-center py-4">No results found</p>;
  return (
    <>
      {data?.children?.map((r: any) => (
        <button key={r.id} onClick={() => onSelect(r.href)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0">
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold flex-shrink-0">child</span>
          <span className="text-sm font-medium text-gray-800">{r.name}</span>
        </button>
      ))}
      {data?.families?.map((r: any) => (
        <button key={r.id} onClick={() => onSelect(r.href)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-green-50 transition-colors text-left border-b border-gray-50 last:border-0">
          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold flex-shrink-0">family</span>
          <span className="text-sm font-medium text-gray-800 font-mono">{r.name}</span>
        </button>
      ))}
      {data?.users?.map((r: any) => (
        <button key={r.id} onClick={() => onSelect(r.href)}
          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-purple-50 transition-colors text-left border-b border-gray-50 last:border-0">
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold capitalize flex-shrink-0">{r.role?.replace("_", " ")}</span>
          <span className="text-sm font-medium text-gray-800">{r.name}</span>
          <span className="text-xs text-gray-400 ml-auto hidden sm:block">{r.email}</span>
        </button>
      ))}
    </>
  );
}

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useLocation()[1];

  const { data } = useQuery({
    queryKey: ["global-search", query],
    queryFn: () => apiGet<any>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
    staleTime: 10000,
  });

  const handleSelect = (href: string) => {
    setQuery("");
    setOpen(false);
    navigate(href);
  };

  return (
    <div className="relative hidden md:block" style={{ width: 240 }}>
      <div className="flex items-center gap-2 px-3 h-8 rounded-xl bg-white/15 border border-white/20 focus-within:bg-white/25 transition-all">
        <Search className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
        <input
          className="flex-1 text-xs text-white placeholder-white/50 bg-transparent outline-none"
          placeholder="Search children, families..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {query && <button onClick={() => setQuery("")} className="text-white/40 hover:text-white text-xs">✕</button>}
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-80 overflow-y-auto">
          <SearchResults data={data} onSelect={handleSelect} />
        </div>
      )}
    </div>
  );
}

function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useLocation()[1];

  const { data, isFetching } = useQuery({
    queryKey: ["global-search-mobile", query],
    queryFn: () => apiGet<any>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
    staleTime: 10000,
  });

  const handleSelect = (href: string) => {
    setQuery("");
    onClose();
    navigate(href);
  };

  return (
    <div className="fixed inset-0 z-[60] md:hidden flex flex-col" style={{ background: "rgba(15,23,42,0.92)", backdropFilter: "blur(8px)" }}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-xl bg-white/15 border border-white/20 focus-within:bg-white/25 transition-all">
          <Search className="w-4 h-4 text-white/60 flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 text-sm text-white placeholder-white/50 bg-transparent outline-none"
            placeholder="Search children, families..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button onClick={() => setQuery("")} className="text-white/40 hover:text-white text-sm">✕</button>}
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white px-2 py-1 text-sm font-medium">Cancel</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Search className="w-12 h-12 text-white/20" />
            <p className="text-white/40 text-sm">Type at least 2 characters to search</p>
          </div>
        ) : isFetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white mx-4 mt-4 rounded-xl overflow-hidden shadow-xl">
            <SearchResults data={data} onSelect={handleSelect} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, login, logout: localLogout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { t } = useLang();

  const qc = useQueryClient();
  const handlePullRefresh = useCallback(async () => {
    await qc.invalidateQueries();
  }, [qc]);
  const ptr = usePullToRefresh(handlePullRefresh);

  const logoutMutation = useLogout();
  const { toast } = useToast();
  const prevUnreadRef = useRef(0);
  const prevMsgRef = useRef(0);

  const { data: notifData } = useQuery({
    queryKey: ["layout-notifications"],
    queryFn: () => apiGet<{ unreadCount: number }>("/notifications?unreadOnly=true&limit=1"),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unreadCount = notifData?.unreadCount ?? 0;

  const { data: msgCountData } = useQuery({
    queryKey: ["layout-msg-unread"],
    queryFn: () => apiGet<{ count: number }>("/messages/unread-count"),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const msgUnreadCount = msgCountData?.count ?? 0;

  useEffect(() => {
    if (prevUnreadRef.current !== 0 && unreadCount > prevUnreadRef.current) {
      const diff = unreadCount - prevUnreadRef.current;
      toast({ title: `${diff} new notification${diff > 1 ? "s" : ""}`, description: "Tap the bell to view your updates." });
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, toast]);

  useEffect(() => {
    if (prevMsgRef.current !== 0 && msgUnreadCount > prevMsgRef.current) {
      toast({ title: "New message received", description: "Someone sent you a message in Shepherd Connect." });
    }
    prevMsgRef.current = msgUnreadCount;
  }, [msgUnreadCount, toast]);

  const handleLogout = async () => {
    try { await logoutMutation.mutateAsync(); } finally { localLogout(); }
  };

  const role = user?.role || "parent";

  const getNavItems = () => {
    const items: Array<{ href: string; label: string; icon: React.ElementType; badge?: number }> = [];
    if (["super_admin", "admin"].includes(role)) {
      items.push({ href: "/dashboard",          label: t.nav.dashboard,    icon: LayoutDashboard });
      items.push({ href: "/families",           label: t.nav.families,     icon: Users });
      items.push({ href: "/children",           label: t.nav.children,     icon: Baby });
      items.push({ href: "/classes",            label: t.nav.classes,      icon: School });
      items.push({ href: "/teachers",           label: t.nav.teachers,     icon: UserCog });
      items.push({ href: "/teacher-allocations",label: t.nav.allocations,  icon: Clock });
      items.push({ href: "/attendance",         label: t.nav.attendance,   icon: CheckSquare });
      items.push({ href: "/emergencies",        label: t.nav.emergencies,  icon: AlertTriangle });
      items.push({ href: "/audit",              label: t.nav.auditLogs,    icon: FileText });
      items.push({ href: "/reports",               label: "Reports",             icon: BarChart3 });
      items.push({ href: "/error-logs",            label: "Error Logs",          icon: AlertTriangle });
      items.push({ href: "/substitute-requests",   label: "Substitute Requests", icon: CalendarClock });
      items.push({ href: "/safeguarding",          label: "Safeguarding & DBS",  icon: ShieldCheck });
      items.push({ href: "/my-concerns",           label: "Concerns & Feedback", icon: MessageSquareWarning });
      items.push({ href: "/safeguarding-cases",    label: "Safeguarding Cases",  icon: ShieldAlert });
      items.push({ href: "/messages",              label: "Messages",            icon: MessageSquare, badge: msgUnreadCount });
      if (role === "super_admin") items.push({ href: "/users", label: t.nav.users, icon: ShieldCheck });
      if (role === "super_admin" || role === "admin") items.push({ href: "/sunday-attendance", label: "Service Attendance", icon: QrCode });
      if (role === "super_admin") items.push({ href: "/settings", label: "Settings", icon: Grid3x3 });
    } else if (role === "parent") {
      items.push({ href: "/my-family",        label: t.nav.myFamily,   icon: Home });
      items.push({ href: "/my-children",      label: t.nav.myChildren, icon: Baby });
      items.push({ href: "/pickup-delegates", label: t.nav.delegates,  icon: UserCog });
      items.push({ href: "/messages",         label: "Messages",       icon: MessageSquare, badge: msgUnreadCount });
      items.push({ href: "/feedback",         label: t.nav.feedback,   icon: Star });
      items.push({ href: "/safeguarding-info", label: "Safeguarding Info",  icon: ShieldCheck });
      items.push({ href: "/my-concerns",       label: "My Concerns",        icon: MessageSquareWarning });
    } else if (role === "teacher") {
      items.push({ href: "/my-class",              label: t.nav.myClass,         icon: School });
      items.push({ href: "/teacher-allocations",   label: "My Schedule",         icon: Clock });
      items.push({ href: "/attendance",            label: t.nav.attendance,      icon: CheckSquare });
      items.push({ href: "/appraisals",            label: t.nav.appraisals,      icon: FileText });
      items.push({ href: "/substitute-requests",   label: "Substitute Requests", icon: CalendarClock });
      items.push({ href: "/my-incidents",          label: "Incident Reports",    icon: AlertTriangle });
      items.push({ href: "/messages",              label: "Messages",            icon: MessageSquare, badge: msgUnreadCount });
    } else if (role === "support") {
      items.push({ href: "/checkin",  label: t.nav.checkin,  icon: ClipboardCheck });
      items.push({ href: "/checkout", label: t.nav.checkout, icon: CheckSquare });
      items.push({ href: "/teachers", label: "My Time Log",  icon: Clock });
    }
    items.push({ href: "/notifications", label: t.nav.notifications, icon: Bell, badge: unreadCount });
    items.push({ href: "/profile", label: "My Profile", icon: UserCircle });
    items.push({ href: "/user-guide", label: "User Guide", icon: BookOpen });
    return items;
  };

  const navItems = getNavItems();

  const getBottomTabs = () => {
    if (role === "parent") return [
      { href: "/my-family",     label: t.nav.myFamily,      icon: Home },
      { href: "/my-children",   label: t.nav.myChildren,    icon: Users },
      { href: "/messages",      label: "Messages",           icon: MessageSquare, badge: msgUnreadCount },
      { href: "/notifications", label: t.nav.notifications, icon: Bell, badge: unreadCount },
    ];
    if (role === "teacher") return [
      { href: "/my-class",      label: t.nav.myClass,       icon: School },
      { href: "/messages",      label: "Messages",           icon: MessageSquare, badge: msgUnreadCount },
      { href: "/notifications", label: t.nav.notifications, icon: Bell, badge: unreadCount },
      { href: "/appraisals",    label: t.nav.appraisals,    icon: FileText },
    ];
    if (role === "support") return [
      { href: "/checkin",  label: t.nav.checkin,       icon: ClipboardCheck },
      { href: "/checkout", label: t.nav.checkout,      icon: CheckSquare },
      { href: "/notifications", label: t.nav.notifications, icon: Bell, badge: unreadCount },
      { href: "/checkin",  label: "QR",                icon: QrCode },
    ];
    return [
      { href: "/dashboard",  label: t.nav.dashboard,  icon: LayoutDashboard },
      { href: "/families",   label: t.nav.families,   icon: Users },
      { href: "/notifications", label: t.nav.notifications, icon: Bell, badge: unreadCount },
      { href: "/emergencies",label: t.nav.emergencies,icon: Grid3x3 },
    ];
  };
  const bottomTabs = getBottomTabs();

  const isActive = (href: string) => location === href;

  const NavItem = ({ item, onClick }: { item: { href: string; label: string; icon: React.ElementType; badge?: number }; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href}>
        <span
          onClick={onClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
          style={active ? { background: "rgba(255,255,255,0.18)", color: "#ffffff" } : { color: "rgba(255,255,255,0.75)" }}
          onMouseOver={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
          onMouseOut={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{item.label}</span>
          {(item.badge ?? 0) > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {(item.badge ?? 0) > 9 ? "9+" : item.badge}
            </span>
          )}
          {active && <ChevronRight className="w-3 h-3 text-white" />}
        </span>
      </Link>
    );
  };

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {navItems.map(item => (
          <NavItem key={item.href} item={item} onClick={onClose} />
        ))}
      </nav>

      {/* Language switcher */}
      <SidebarLangSwitcher />

      {/* Logout */}
      <div className="px-4 pb-4 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-300 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t.nav.signOut}
        </button>
      </div>
    </>
  );

  const SidebarHeader = () => (
    <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
      <div className="rccg-logo-wrap" style={{ width: 50, height: 50 }}>
        <img src="/rccg-logo-new.png" alt="RCCG" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      </div>
      <div>
        <p className="text-white font-semibold text-sm leading-tight">Shepherd Connect</p>
        <p className="text-white/60 text-[10px] font-medium tracking-wide">City of David</p>
      </div>
    </div>
  );

  const UserChip = () => {
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const allRoles: string[] = (user as any)?.allRoles ?? [role];
    const roleLabels: Record<string, string> = { parent: "Parent", teacher: "Teacher", support: "Support", admin: "Admin", super_admin: "Super Admin" };
    const roleIcons: Record<string, string> = { parent: "👨‍👩‍👧", teacher: "📚", support: "🎫", admin: "🛡️", super_admin: "⚡" };

    const handleSwitch = async (newRole: string) => {
      if (newRole === role || switching) return;
      setSwitching(true);
      setOpen(false);
      try {
        const res = await apiPost<{ token: string; user: any }>("/auth/switch-role", { role: newRole });
        login(res.token, res.user);
        if (newRole === "parent") setLocation("/my-family");
        else if (newRole === "teacher") setLocation("/my-class");
        else if (newRole === "support") setLocation("/checkin");
        else setLocation("/dashboard");
      } catch (e: any) {
        toast({ variant: "destructive", title: "Could not switch role", description: e.message });
      } finally {
        setSwitching(false);
      }
    };

    return (
      <div className="mx-4 mt-4 mb-2 relative">
        <div className="px-3 py-2.5 rounded-xl bg-white/10 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-[#1a237e] text-sm flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-white/50 text-[10px] capitalize">{role.replace(/_/g, " ")}</p>
          </div>
          {allRoles.length > 1 && (
            <button onClick={() => setOpen(o => !o)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Switch role">
              <ChevronDown className="w-3.5 h-3.5 text-white/60"
                style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
            </button>
          )}
        </div>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{ background: "rgba(15,23,42,0.97)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider px-3 pt-2.5 pb-1">Switch role</p>
            {allRoles.map(r => (
              <button key={r} onClick={() => handleSwitch(r)}
                disabled={r === role || switching}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium transition-all"
                style={r === role ? { color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)" } : { color: "rgba(255,255,255,0.65)" }}
                onMouseOver={e => { if (r !== role) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                onMouseOut={e => { if (r !== role) (e.currentTarget as HTMLElement).style.background = ""; }}>
                <span>{roleIcons[r] ?? "👤"}</span>
                <span className="flex-1">{roleLabels[r] ?? r}</span>
                {r === role && <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">Active</span>}
                {r !== role && switching && <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isOnline = useOnlineStatus();

  return (
    <div className="flex min-h-screen w-full bg-background">

      {/* ── Mobile Search Overlay ── */}
      {mobileSearchOpen && <MobileSearchOverlay onClose={() => setMobileSearchOpen(false)} />}

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-64 fixed left-0 top-0 bottom-0 z-40"
        style={{ background: "linear-gradient(180deg, #172554 0%, #1e3a8a 100%)" }}
      >
        <SidebarHeader />
        <UserChip />
        <SidebarContent />
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
                <div className="rccg-logo-wrap" style={{ width: 50, height: 50 }}>
                  <img src="/rccg-logo-new.png" alt="RCCG" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                </div>
                <p className="text-white font-semibold text-sm">Shepherd Connect</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <UserChip />
            <SidebarContent onClose={() => setSidebarOpen(false)} />
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
          <button className="md:hidden text-white/80 hover:text-white" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo (mobile) */}
          <div className="md:hidden flex items-center gap-2 flex-1">
            <div className="rccg-logo-wrap" style={{ width: 34, height: 34 }}>
              <img src="/rccg-logo-new.png" alt="RCCG" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
            </div>
            <span className="text-white font-semibold text-sm">Shepherd Connect</span>
          </div>

          {/* Desktop search — available to all roles */}
          <div className="hidden md:flex flex-1 items-center gap-4">
            <GlobalSearch />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Mobile search icon */}
            <button
              className="md:hidden w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search">
              <Search className="w-4 h-4 text-white" />
            </button>

            {/* Language pill (header, visible on mobile) */}
            <div className="md:hidden">
              <MobileLangMenu />
            </div>

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
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-bold text-[#1a237e] text-xs shadow-md cursor-pointer hover:opacity-80 transition-opacity" title="My Profile">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
            </Link>
          </div>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "#b45309" }}>
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            You are offline. Check-ins will be queued and synced when connectivity is restored.
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          <PullToRefreshIndicator {...ptr} />
          {children}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-end pb-safe"
          style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(30,58,138,0.10)" }}
        >
          {bottomTabs.slice(0, 2).map(tab => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} className="flex-1">
                <span className="flex flex-col items-center gap-1 py-2.5 transition-all cursor-pointer">
                  <div className="relative">
                    <Icon className="w-5 h-5" style={{ color: active ? "#1e3a8a" : "#94a3b8" }} />
                    {"badge" in tab && tab.badge && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                        {tab.badge > 9 ? "9+" : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium truncate max-w-[52px] text-center" style={{ color: active ? "#1e3a8a" : "#94a3b8" }}>
                    {tab.label}
                  </span>
                </span>
              </Link>
            );
          })}

          {/* Center QR */}
          <div className="flex-1 flex justify-center items-center pb-1">
            <Link href={role === "support" ? "/checkin" : role === "parent" ? "/my-family" : "/checkin"}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #1a237e, #283593)", boxShadow: "0 4px 16px rgba(26,35,126,0.5)" }}
              >
                <QrCode className="w-6 h-6 text-white" />
              </div>
            </Link>
          </div>

          {bottomTabs.slice(2, 4).map(tab => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href + "-r"} href={tab.href} className="flex-1">
                <span className="flex flex-col items-center gap-1 py-2.5 transition-all cursor-pointer">
                  <div className="relative">
                    <Icon className="w-5 h-5" style={{ color: active ? "#1e3a8a" : "#94a3b8" }} />
                    {"badge" in tab && tab.badge && tab.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                        {tab.badge > 9 ? "9+" : tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium truncate max-w-[52px] text-center" style={{ color: active ? "#1e3a8a" : "#94a3b8" }}>
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

function MobileLangMenu() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === lang)!;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium"
        style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.90)" }}
      >
        <Globe className="w-3 h-3" />
        <span>{current.flag}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-40 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{ background: "rgba(15,23,42,0.97)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code as LangCode); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-left transition-all"
              style={
                lang === l.code
                  ? { background: "rgba(255,255,255,0.15)", color: "#ffffff" }
                  : { color: "rgba(255,255,255,0.75)" }
              }
              onMouseOver={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
              onMouseOut={e => { if (lang !== l.code) (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              <span>{l.flag}</span>
              <span className="flex-1">{l.nativeName}</span>
              {lang === l.code && <span className="text-white">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
