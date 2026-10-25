import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setDemoHeader } from "@workspace/api-client-react";

import { AuthGuard } from "@/components/auth-guard";
import { Navbar } from "@/components/navbar";
import { StudentShell } from "@/components/student-shell";
import { useAuthStore } from "@/hooks/use-auth-store";

// Pages
import LoginPage from "@/pages/login";
import StudentHome from "@/pages/student/home";
import StudentProfile from "@/pages/student/profile";
import StudentJobs from "@/pages/student/jobs";
import StudentApplications from "@/pages/student/applications";
import StudentInsights from "@/pages/student/insights";
import StudentDocuments from "@/pages/student/documents";
import StudentNotifications from "@/pages/student/notifications";
import StudentSettings from "@/pages/student/settings";

import RecruiterDashboard from "@/pages/recruiter/dashboard";
import RecruiterJobs from "@/pages/recruiter/jobs";
import RecruiterProfile from "@/pages/recruiter/profile";
import NotFound from "@/pages/not-found";

const configuredClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = configuredClerkKey
  ? publishableKeyFromHost(window.location.hostname, configuredClerkKey)
  : undefined;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(239 84% 67%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215.4 16.3% 46.9%)",
    colorDanger: "hsl(0 84.2% 60.2%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214.3 31.8% 91.4%)",
    fontFamily: "Inter, -apple-system, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "text-sm font-medium",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    formFieldInput: "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function RegisterStudentPage() {
  const { setRole, setDemoMode } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setRole("student");
    if (!clerkPubKey) {
      setDemoMode(true);
      setLocation("/home");
    } else {
      setLocation("/sign-up");
    }
  }, [setRole, setDemoMode, setLocation]);

  return null;
}

function RegisterRecruiterPage() {
  const { setRole, setDemoMode } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setRole("recruiter");
    if (!clerkPubKey) {
      setDemoMode(true);
      setLocation("/recruiter");
    } else {
      setLocation("/sign-up");
    }
  }, [setRole, setDemoMode, setLocation]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function DemoHeaderSync() {
  const { demoMode, role } = useAuthStore();
  useEffect(() => {
    setDemoHeader(demoMode && role ? role : null);
  }, [demoMode, role]);
  return null;
}

function HomeRedirect() {
  const { role, demoMode } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (role === "recruiter") {
      setLocation("/recruiter");
    } else if (role === "student") {
      setLocation("/home");
    } else {
      setLocation("/login");
    }
  }, [role, setLocation, demoMode]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

const queryClient = new QueryClient();

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkPubKey) {
    return (
      <QueryClientProvider client={queryClient}>
        <DemoHeaderSync />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <DemoHeaderSync />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppRoutes() {
  return (
    <>
      <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/login" component={LoginPage} />

            <Route path="/sign-in/*?" component={clerkPubKey ? SignInPage : LoginPage} />
            <Route path="/sign-up/*?" component={clerkPubKey ? SignUpPage : LoginPage} />
            <Route path="/register/student" component={RegisterStudentPage} />
            <Route path="/register/recruiter" component={RegisterRecruiterPage} />

            <Route path="/home">
              <AuthGuard allowedRole="student">
                <StudentShell title="Student Dashboard"><StudentHome /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/profile">
              <AuthGuard allowedRole="student">
                <StudentShell title="My Profile"><StudentProfile /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/jobs">
              <AuthGuard allowedRole="student">
                <StudentShell title="Find Jobs"><StudentJobs /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/applications">
              <AuthGuard allowedRole="student">
                <StudentShell title="My Applications"><StudentApplications /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/insights">
              <AuthGuard allowedRole="student">
                <StudentShell title="AI Career Insights"><StudentInsights /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/documents">
              <AuthGuard allowedRole="student">
                <StudentShell title="Resume & Documents"><StudentDocuments /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/notifications">
              <AuthGuard allowedRole="student">
                <StudentShell title="Notifications"><StudentNotifications /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/settings">
              <AuthGuard allowedRole="student">
                <StudentShell title="Student Settings"><StudentSettings /></StudentShell>
              </AuthGuard>
            </Route>

            <Route path="/recruiter">
              <AuthGuard allowedRole="recruiter">
                <div className="min-h-[100dvh] flex flex-col bg-slate-50">
                  <Navbar />
                  <RecruiterDashboard />
                </div>
              </AuthGuard>
            </Route>

            <Route path="/recruiter/jobs">
              <AuthGuard allowedRole="recruiter">
                <div className="min-h-[100dvh] flex flex-col bg-slate-50">
                  <Navbar />
                  <RecruiterJobs />
                </div>
              </AuthGuard>
            </Route>

            <Route path="/recruiter/profile">
              <AuthGuard allowedRole="recruiter">
                <div className="min-h-[100dvh] flex flex-col bg-slate-50">
                  <Navbar />
                  <RecruiterProfile />
                </div>
              </AuthGuard>
            </Route>

            <Route>
              <div className="min-h-[100dvh] flex flex-col">
                <Navbar />
                <NotFound />
              </div>
            </Route>
      </Switch>
    </>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
