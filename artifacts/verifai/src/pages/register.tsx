import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { SignUp, useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Briefcase, Sparkles, Rocket, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  if (!clerkEnabled) {
    return <RegisterContent clerkEnabled={false} />;
  }

  return <ClerkRegisterPage />;
}

function ClerkRegisterPage() {
  const { isSignedIn, isLoaded } = useAuth();
  return <RegisterContent clerkEnabled={true} isSignedIn={isSignedIn} isLoaded={isLoaded} />;
}

function RegisterContent({ clerkEnabled, isSignedIn, isLoaded }: { clerkEnabled: boolean; isSignedIn?: boolean; isLoaded?: boolean }) {
  const { role, setRole, setDemoMode } = useAuthStore();
  const [, setLocation] = useLocation();
  const [selectedRole, setSelectedRole] = useState<"student" | "recruiter">(role || "student");

  // Redirect signed-in users away from register
  useEffect(() => {
    if (clerkEnabled && isLoaded && isSignedIn) {
      setLocation(role === "recruiter" ? "/recruiter" : "/home");
    }
  }, [isLoaded, isSignedIn, role, setLocation, clerkEnabled]);

  const handleRoleSelect = (r: "student" | "recruiter") => {
    setSelectedRole(r);
    setRole(r);
  };

  const handleDemoRegister = (r: "student" | "recruiter") => {
    setRole(r);
    setDemoMode(true);
    setLocation(r === "recruiter" ? "/recruiter" : "/home");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-950 text-white relative overflow-hidden">
      {/* 3D Cosmic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "10s" }} />

        {/* Floating Starfield Particles */}
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute bg-white rounded-full opacity-60"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-xl w-full"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
                <Rocket className="w-3.5 h-3.5 text-indigo-400" /> Create Your VERIF-AI Account
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
                Join the Platform
              </h1>
              <p className="text-slate-400 text-sm md:text-base">
                Choose your role and register securely using Google SSO or Email OTP verification.
              </p>
            </div>

            {/* Role Selection Tabs */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                type="button"
                onClick={() => handleRoleSelect("student")}
                className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${
                  selectedRole === "student"
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <GraduationCap className={`w-6 h-6 mb-2 ${selectedRole === "student" ? "text-indigo-400" : "text-slate-400"}`} />
                <span className="font-semibold text-sm">Student</span>
                <span className="text-xs text-slate-400 mt-0.5">Build profile & apply</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect("recruiter")}
                className={`flex flex-col items-center p-4 rounded-2xl border transition-all ${
                  selectedRole === "recruiter"
                    ? "bg-violet-600/20 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Briefcase className={`w-6 h-6 mb-2 ${selectedRole === "recruiter" ? "text-violet-400" : "text-slate-400"}`} />
                <span className="font-semibold text-sm">Recruiter</span>
                <span className="text-xs text-slate-400 mt-0.5">Hire verified talent</span>
              </button>
            </div>

            {/* Registration Card / Clerk Component */}
            <Card className="border border-indigo-500/30 bg-slate-900/80 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden p-2 md:p-6">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl font-bold text-white">
                  Register as {selectedRole === "student" ? "Student" : "Recruiter"}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {clerkEnabled ? "Authenticate with Google or receive a 6-digit OTP code in your email." : "Demo mode active."}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col items-center justify-center pt-2">
                {clerkEnabled ? (
                  <div className="w-full flex justify-center">
                    <SignUp
                      routing="path"
                      path="/register"
                      signInUrl="/login"
                      unsafeMetadata={{ role: selectedRole }}
                    />
                  </div>
                ) : (
                  <div className="w-full space-y-4 py-4 text-center">
                    <p className="text-sm text-slate-300">Clerk publishable key not detected. Enter demo mode instantly:</p>
                    <Button
                      size="lg"
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold"
                      onClick={() => handleDemoRegister(selectedRole)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" /> Start {selectedRole === "student" ? "Student" : "Recruiter"} Demo
                    </Button>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between items-center border-t border-slate-800/80 pt-4 px-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-400 hover:text-white"
                  onClick={() => setLocation("/login")}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Already have an account? Sign in
                </Button>
              </CardFooter>
            </Card>

          </motion.div>
        </main>
      </div>
    </div>
  );
}
