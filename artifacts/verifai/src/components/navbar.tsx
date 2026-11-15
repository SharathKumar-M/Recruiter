import { useAuthStore } from "@/hooks/use-auth-store";
import { useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { ShieldCheck, LogOut, User, Briefcase, FileText } from "lucide-react";
import { Button } from "./ui/button";

export function Navbar() {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    import.meta.env.CLERK_PUBLISHABLE_KEY
  );

  return clerkEnabled ? <ClerkNavbar /> : <LocalNavbar />;
}

function ClerkNavbar() {
  const { signOut } = useClerk();
  return (
    <NavbarContent
      onSignOut={async () => {
        await signOut({ redirectUrl: "/login" });
      }}
    />
  );
}

function LocalNavbar() {
  return <NavbarContent />;
}

function NavbarContent({ onSignOut }: { onSignOut?: () => Promise<void> | void }) {
  const { role, logout, setIsLoggingOut } = useAuthStore();
  const [location, setLocation] = useLocation();

  const handleLogout = async () => {
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

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={role === "recruiter" ? "/recruiter" : "/home"}>
          <div className="flex items-center gap-2 font-bold text-xl text-primary hover:opacity-90 transition-opacity cursor-pointer">
            <ShieldCheck className="w-6 h-6" />
            <span>VERIF-AI</span>
          </div>
        </Link>

        {role && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              {role === "student" ? (
                <>
                  <Link href="/home">
                    <span className={`hover:text-primary transition-colors cursor-pointer ${location === "/home" ? "text-primary" : ""}`}>
                      Jobs
                    </span>
                  </Link>
                  <Link href="/profile">
                    <span className={`hover:text-primary transition-colors cursor-pointer flex items-center gap-1 ${location === "/profile" ? "text-primary" : ""}`}>
                      <User className="w-4 h-4" /> Profile
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/recruiter">
                    <span className={`hover:text-primary transition-colors cursor-pointer flex items-center gap-1 ${location === "/recruiter" ? "text-primary" : ""}`}>
                      <Briefcase className="w-4 h-4" /> Dashboard
                    </span>
                  </Link>
                  <Link href="/recruiter/jobs">
                    <span className={`hover:text-primary transition-colors cursor-pointer flex items-center gap-1 ${location === "/recruiter/jobs" ? "text-primary" : ""}`}>
                      <FileText className="w-4 h-4" /> My Jobs
                    </span>
                  </Link>
                  <Link href="/recruiter/profile">
                    <span className={`hover:text-primary transition-colors cursor-pointer flex items-center gap-1 ${location === "/recruiter/profile" ? "text-primary" : ""}`}>
                      <User className="w-4 h-4" /> Profile
                    </span>
                  </Link>
                </>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
