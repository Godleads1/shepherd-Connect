import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  LayoutDashboard,
  Users,
  Baby,
  School,
  ClipboardCheck,
  CheckSquare,
  LogOut,
  Menu,
  Bell,
  MessageSquare,
  AlertTriangle,
  UserCog,
  FileText,
  Clock,
  ShieldCheck,
  Moon,
  Sun
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout: localLogout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      localLogout();
    }
  };

  const role = user?.role || "parent";

  const getNavItems = () => {
    const items = [];

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
      if (role === "super_admin") {
        items.push({ href: "/users", label: "Users", icon: ShieldCheck });
      }
    } else if (role === "parent") {
      items.push({ href: "/my-family", label: "My Family", icon: Users });
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

    // Everyone gets notifications
    items.push({ href: "/notifications", label: "Notifications", icon: Bell });

    return items;
  };

  const navItems = getNavItems();

  const NavLinks = () => (
    <div className="flex flex-col gap-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Mobile Topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="sm:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar border-sidebar-border sm:max-w-xs">
            <div className="flex h-14 items-center border-b border-sidebar-border px-4 mb-4">
              <span className="font-semibold text-sidebar-foreground">Shepherd Connect</span>
            </div>
            <nav className="grid gap-2 text-lg font-medium">
              <NavLinks />
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <Button
                variant="destructive"
                className="w-full justify-start gap-3"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex-1">
          <span className="font-semibold">Shepherd Connect</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 flex-col border-r bg-sidebar border-sidebar-border md:flex">
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
              <span className="">Shepherd Connect</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <NavLinks />
            </nav>
          </div>
          <div className="mt-auto p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 bg-transparent text-sidebar-foreground hover:bg-sidebar-accent border-sidebar-border"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
