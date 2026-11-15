import { useEffect, useRef, useCallback } from "react";
import { useAuth, useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useSyncUser } from "@workspace/api-client-react";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: "student" | "recruiter";
}

export function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    import.meta.env.CLERK_PUBLISHABLE_KEY
  );

  if (!clerkEnabled) {
    return <LocalAuthGuard allowedRole={allowedRole}>{children}</LocalAuthGuard>;
  }

  return <ClerkAuthGuard allowedRole={allowedRole}>{children}</ClerkAuthGuard>;
}

function LocalAuthGuard({ children, allowedRole }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const { role, isLoggingOut } = useAuthStore();

  useEffect(() => {
    if (!isLoggingOut && !role) {
      setLocation("/login");
    }
  }, [role, isLoggingOut, setLocation]);

  if (!role || (allowedRole && role !== allowedRole) || isLoggingOut) {
    return null;
  }
  return <>{children}</>;
}

function ClerkAuthGuard({ children, allowedRole }: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const {
    role,
    setRole,
    syncComplete,
    setSyncComplete,
    syncedUserId,
    setSyncedUserId,
    syncError,
    setSyncError,
    demoMode,
    isLoggingOut,
    setIsLoggingOut,
    logout,
  } = useAuthStore();
  const syncUserMutation = useSyncUser();
  const syncInProgressRef = useRef(false);

  // Unauthenticated redirect to login
  useEffect(() => {
    if (demoMode || isLoggingOut) return;
    if (isLoaded && !isSignedIn) {
      setLocation("/login");
    }
  }, [isLoaded, isSignedIn, setLocation, demoMode, isLoggingOut]);

  // Synchronize Clerk user with backend once per session/user
  useEffect(() => {
    if (demoMode || isLoggingOut) {
      return undefined;
    }

    if (!isLoaded || !isSignedIn || !user) {
      return undefined;
    }

    // Already synced for this specific Clerk user
    if (syncComplete && syncedUserId === user.id) {
      return undefined;
    }

    // Prevent duplicate in-flight requests
    if (syncInProgressRef.current) {
      return undefined;
    }

    syncInProgressRef.current = true;
    setSyncError(null);

    const activeRole = role || (user.unsafeMetadata?.role as "student" | "recruiter") || "student";
    if (!role) {
      setRole(activeRole);
    }

    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      "";

    syncUserMutation.mutate(
      {
        data: {
          clerkId: user.id,
          email,
          role: activeRole,
          displayName: user.fullName ?? user.firstName ?? user.username ?? "User",
        },
      },
      {
        onSuccess: (data: { userId: string | number; role: string }) => {
          syncInProgressRef.current = false;
          // Apply authoritative role returned by the backend
          const authoritativeRole = data?.role === "recruiter" ? "recruiter" : "student";
          setRole(authoritativeRole);
          setSyncedUserId(user.id);
          setSyncComplete(true);
          setSyncError(null);
        },
        onError: (err: any) => {
          syncInProgressRef.current = false;
          setSyncComplete(false);
          const message =
            err?.data?.error ||
            err?.message ||
            "Failed to synchronize your account with the server.";
          setSyncError(message);
          console.error("Clerk user sync error:", err);
        },
      }
    );

    return undefined;
  }, [
    isLoaded,
    isSignedIn,
    user?.id,
    syncComplete,
    syncedUserId,
    demoMode,
    isLoggingOut,
    role,
    setRole,
    setSyncComplete,
    setSyncedUserId,
    setSyncError,
  ]);

  // Route protection & role redirection after sync completes
  useEffect(() => {
    if (demoMode || isLoggingOut) return;
    if (isLoaded && isSignedIn && syncComplete && allowedRole && role !== allowedRole) {
      setLocation(role === "recruiter" ? "/recruiter" : "/home");
    }
  }, [isLoaded, isSignedIn, syncComplete, allowedRole, role, setLocation, demoMode, isLoggingOut]);

  const handleRetry = useCallback(() => {
    syncInProgressRef.current = false;
    setSyncError(null);
    setSyncComplete(false);
    setSyncedUserId(null);
  }, [setSyncError, setSyncComplete, setSyncedUserId]);

  const handleSignOut = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ redirectUrl: "/login" });
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      logout();
      setLocation("/login");
      setIsLoggingOut(false);
    }
  }, [logout, signOut, setIsLoggingOut, setLocation]);

  if (demoMode) {
    if (allowedRole && role !== allowedRole) return null;
    return <>{children}</>;
  }

  if (isLoggingOut) {
    return null;
  }

  // Display authentication/synchronization error with retry capability
  if (syncError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-lg border border-red-200 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Authentication Synchronization Failed
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            {syncError}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleRetry}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Synchronization
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while Clerk initializes or synchronization is in progress
  if (!isLoaded || (isSignedIn && !syncComplete)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-600">Synchronizing account with server...</p>
      </div>
    );
  }

  if (allowedRole && role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
