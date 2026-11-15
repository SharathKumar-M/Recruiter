import {
  Bell,
  Bot,
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  { label: "Dashboard", href: "/home", icon: LayoutDashboard },
  { label: "Find Jobs", href: "/jobs", icon: BriefcaseBusiness },
  { label: "My Applications", href: "/applications", icon: FileText },
  { label: "My Profile", href: "/profile", icon: UserRound },
  { label: "Resume & Documents", href: "/documents", icon: FileText },
  { label: "AI Career Insights", href: "/insights", icon: Bot },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

function StudentNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="space-y-1">
      {navigation.map(({ label, href, icon: Icon }) => {
        const active =
          location === href ||
          (href === "/home" && location === "/home") ||
          (href === "/jobs" && location.startsWith("/jobs")) ||
          (href === "/applications" && location.startsWith("/applications")) ||
          (href === "/profile" && location === "/profile") ||
          (href === "/documents" && location.startsWith("/documents")) ||
          (href === "/insights" && location.startsWith("/insights")) ||
          (href === "/notifications" && location.startsWith("/notifications")) ||
          (href === "/settings" && location.startsWith("/settings"));

        return (
          <Link
            key={label}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentShell({ title, children }: { title: string; children: React.ReactNode }) {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    import.meta.env.CLERK_PUBLISHABLE_KEY
  );

  return clerkEnabled ? (
    <ClerkStudentShell title={title}>{children}</ClerkStudentShell>
  ) : (
    <LocalStudentShell title={title}>{children}</LocalStudentShell>
  );
}

function ClerkStudentShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { signOut } = useClerk();
  return (
    <StudentShellContent
      title={title}
      onSignOut={async () => {
        await signOut({ redirectUrl: "/login" });
      }}
    >
      {children}
    </StudentShellContent>
  );
}

function LocalStudentShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <StudentShellContent title={title}>
      {children}
    </StudentShellContent>
  );
}

function StudentShellContent({
  title,
  children,
  onSignOut,
}: {
  title: string;
  children: React.ReactNode;
  onSignOut?: () => Promise<void> | void;
}) {
  const { logout, role, setIsLoggingOut } = useAuthStore();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setLocation(`/jobs?search=${encodeURIComponent(search)}`);
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      if (onSignOut) {
        await onSignOut();
      }
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      logout();
      setLocation("/login");
      setIsLoggingOut(false);
    }
  };

  const initial = role === "student" ? "S" : "U";

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fc] text-slate-950">
      <aside className="fixed inset-y-0 hidden w-64 border-r border-slate-200/80 bg-white px-4 py-6 lg:block shadow-sm z-30">
        <Link href="/home" className="mb-8 flex items-center gap-2.5 px-2 text-lg font-bold tracking-tight text-slate-950">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          VERIF-AI
        </Link>
        <StudentNav />
        <div className="absolute inset-x-4 bottom-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs leading-5 text-indigo-900">
          <p className="font-semibold mb-1">Verified Talent</p>
          Complete your profile to build employer trust and unlock AI insights.
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 sm:gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-8 shadow-xs">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden text-slate-700">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-6 flex flex-col justify-between">
              <div>
                <Link href="/home" onClick={() => setMobileOpen(false)} className="mb-8 flex items-center gap-2.5 text-lg font-bold">
                  <ShieldCheck className="h-6 w-6 text-indigo-600" />
                  VERIF-AI
                </Link>
                <StudentNav onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="border-t border-slate-200/80 pt-4 mt-auto space-y-2">
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {initial}
                  </span>
                  My Profile
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h1>

          <form onSubmit={submitSearch} className="hidden max-w-sm flex-1 md:block">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search jobs..."
                className="h-9 bg-slate-50/80 pl-9 rounded-xl border-slate-200"
              />
            </div>
          </form>

          {/* Notifications icon */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
          >
            <Link href="/notifications">
              <Bell className="h-5 w-5" />
            </Link>
          </Button>

          {/* Account button: Navigates to /profile, NEVER logs out */}
          <Button
            asChild
            variant="ghost"
            className="gap-2 rounded-full px-2 text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="My Profile"
          >
            <Link href="/profile">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                {initial}
              </span>
              <span className="hidden text-sm font-medium md:block">Account</span>
            </Link>
          </Button>

          {/* Sign Out button: Terminates session and redirects to /login */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="gap-2 text-slate-600 hover:text-slate-950 hover:bg-slate-100 rounded-xl px-2.5 sm:px-3 text-xs sm:text-sm font-medium cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </header>

        {children}
      </div>
    </div>
  );
}
