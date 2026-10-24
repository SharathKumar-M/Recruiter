import { Bell, Bot, BriefcaseBusiness, FileText, LayoutDashboard, Menu, Search, Settings, ShieldCheck, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuthStore } from "@/hooks/use-auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  { label: "Dashboard", href: "/home", icon: LayoutDashboard },
  { label: "Find Jobs", href: "/jobs", icon: BriefcaseBusiness },
  { label: "My Applications", href: "/applications", icon: FileText },
  { label: "My Profile", href: "/profile", icon: UserRound },
  { label: "Resume & Documents", href: "/profile#documents", icon: FileText },
  { label: "AI Career Insights", href: "/insights", icon: Bot },
  { label: "Settings", href: "/profile#settings", icon: Settings },
];

function StudentNav({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="space-y-1">
      {navigation.map(({ label, href, icon: Icon }) => {
        const active = href === "/home" ? location === "/home" : href === "/jobs" ? location === "/jobs" : href === "/applications" ? location === "/applications" : href === "/insights" ? location === "/insights" : href.startsWith("/profile") && location === "/profile";
        return (
          <Link key={label} href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { logout, role } = useAuthStore();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setLocation(`/jobs?search=${encodeURIComponent(search)}`);
  };
  const initial = role === "student" ? "S" : "U";

  return (
    <div className="min-h-[100dvh] bg-[#f7f8fc] text-slate-950">
      <aside className="fixed inset-y-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/home" className="mb-9 flex items-center gap-2 px-2 text-lg font-bold tracking-tight text-slate-950"><ShieldCheck className="h-6 w-6 text-indigo-600" />VERIF-AI</Link>
        <StudentNav />
        <div className="absolute inset-x-4 bottom-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">Complete your profile to help recruiters understand your strengths.</div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden"><Menu className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="left" className="w-72 p-4"><Link href="/home" onClick={() => setMobileOpen(false)} className="mb-8 flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-6 w-6 text-indigo-600" />VERIF-AI</Link><StudentNav onNavigate={() => setMobileOpen(false)} /></SheetContent></Sheet>
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">{title}</h1>
          <form onSubmit={submitSearch} className="hidden max-w-sm flex-1 md:block"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs" className="h-9 bg-slate-50 pl-9" /></div></form>
          <Button variant="ghost" size="icon" aria-label="Notifications" className="text-slate-600"><Bell className="h-5 w-5" /></Button>
          <Button variant="ghost" onClick={() => { logout(); setLocation("/"); }} className="gap-2 rounded-full px-2 text-slate-700"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initial}</span><span className="hidden text-sm md:block">Account</span></Button>
        </header>
        {children}
      </div>
    </div>
  );
}
