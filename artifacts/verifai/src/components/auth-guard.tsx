import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useSyncUser } from "@workspace/api-client-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRole?: "student" | "recruiter";
}

export function AuthGuard({ children, allowedRole }: AuthGuardProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { role, syncComplete, setSyncComplete } = useAuthStore();
  const syncUser = useSyncUser();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation("/login");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user && role && !syncComplete) {
      syncUser.mutate(
        {
          data: {
            clerkId: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? "",
            role: role,
            displayName: user.fullName ?? user.firstName ?? "User",
          },
        },
        {
          onSuccess: () => {
            setSyncComplete(true);
          },
        }
      );
    }
  }, [isLoaded, isSignedIn, user, role, syncComplete, syncUser, setSyncComplete]);

  useEffect(() => {
    if (isLoaded && isSignedIn && syncComplete && allowedRole && role !== allowedRole) {
      setLocation(role === "recruiter" ? "/recruiter" : "/home");
    }
  }, [isLoaded, isSignedIn, syncComplete, allowedRole, role, setLocation]);

  if (!isLoaded || (isSignedIn && !syncComplete)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (allowedRole && role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
