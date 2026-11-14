import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useSignIn } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Briefcase, Zap, Sparkles, Rocket, Globe, ShieldCheck, Mail } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { motion } from "framer-motion";

export default function LoginPage() {
  const clerkEnabled = Boolean(
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    import.meta.env.CLERK_PUBLISHABLE_KEY
  );

  if (!clerkEnabled) {
    return <LoginContent clerkEnabled={false} />;
  }

  return <ClerkLoginPage />;
}

function ClerkLoginPage() {
  const { signIn } = useSignIn() as { signIn: any };
  return <LoginContent clerkEnabled={true} signIn={signIn} />;
}

function LoginContent({ clerkEnabled, signIn }: { clerkEnabled: boolean; signIn?: any }) {
  const { setRole, setDemoMode } = useAuthStore();
  const [, setLocation] = useLocation();

  const handleGoogleLogin = async (roleType: "student" | "recruiter") => {
    setRole(roleType);
    if (!clerkEnabled) {
      setDemoMode(true);
      setLocation(roleType === "recruiter" ? "/recruiter" : "/home");
      return;
    }
    setDemoMode(false);
    try {
      if (signIn?.authenticateWithRedirect) {
        await signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: roleType === "recruiter" ? "/recruiter" : "/home",
        });
        return;
      }
    } catch (err) {
      console.error("Google OAuth error:", err);
    }
    setLocation("/sign-in");
  };

  const handleEmailOtpLogin = (roleType: "student" | "recruiter") => {
    setRole(roleType);
    if (!clerkEnabled) {
      setDemoMode(true);
      setLocation(roleType === "recruiter" ? "/recruiter" : "/home");
      return;
    }
    setDemoMode(false);
    setLocation("/sign-in");
  };

  const handleDemoPreview = (roleType: "student" | "recruiter") => {
    setRole(roleType);
    setDemoMode(true);
    setLocation(roleType === "recruiter" ? "/recruiter" : "/home");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-950 text-white relative overflow-hidden">
      {/* 3D Cosmic Background Elements & Glowing Nebulas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute top-1/2 right-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />

        {/* Floating Starfield Particles */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-white rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
            }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}

        {/* Orbiting Cosmic Ring */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] border border-indigo-500/10 rounded-full animate-spin" style={{ animationDuration: "60s" }} />
        <div className="absolute -bottom-40 -left-40 w-[800px] h-[800px] border border-violet-500/10 rounded-full animate-spin" style={{ animationDuration: "90s" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-5xl w-full"
          >
            {/* Header Badge & Title */}
            <div className="text-center mb-12">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4 backdrop-blur-md shadow-lg shadow-indigo-500/10"
              >
                <Rocket className="w-3.5 h-3.5 text-indigo-400" /> Next-Gen Verified Recruitment Portal
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent mb-4">
                Welcome to VERIF-AI
              </h1>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
                Secure enterprise recruitment with Google SSO and Email OTP verification for students & recruiters.
              </p>
            </div>

            {/* Login Selection Cards */}
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">

              {/* Student Portal Card */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border border-indigo-500/30 bg-slate-900/70 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <CardHeader className="text-center pb-4 pt-8">
                    <div className="mx-auto w-18 h-18 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/30 text-white transform group-hover:rotate-6 transition-transform">
                      <GraduationCap className="w-9 h-9" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Student Portal</CardTitle>
                    <CardDescription className="text-slate-400 text-sm mt-1.5">
                      Sign in or create account with Google SSO or Email OTP verification.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 px-6 pb-6">
                    {/* Google SSO Button */}
                    <Button
                      size="lg"
                      className="w-full h-13 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold shadow-lg gap-3 transition-all"
                      onClick={() => handleGoogleLogin("student")}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.23 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.5-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.83 0 12s.43 3.87 1.18 5.39l4.09-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.68 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
                      </svg>
                      Continue with Google SSO
                    </Button>

                    {/* Email with OTP Verification Button */}
                    <Button
                      size="lg"
                      className="w-full h-13 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-600/30 gap-3 transition-all"
                      onClick={() => handleEmailOtpLogin("student")}
                    >
                      <Mail className="w-5 h-5 text-indigo-200" /> Register / Sign In with Email (OTP)
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-10 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl gap-2 text-xs"
                      onClick={() => handleDemoPreview("student")}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Instant Student Demo Preview
                    </Button>
                  </CardContent>

                  <CardFooter className="justify-center border-t border-slate-800/80 bg-slate-950/40 py-4">
                    <p className="text-xs text-slate-400">
                      Secure email verification with instant 6-digit OTP codes.
                    </p>
                  </CardFooter>
                </Card>
              </motion.div>

              {/* Recruiter Portal Card */}
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border border-violet-500/30 bg-slate-900/70 backdrop-blur-2xl shadow-2xl rounded-3xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <CardHeader className="text-center pb-4 pt-8">
                    <div className="mx-auto w-18 h-18 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-violet-600/30 text-white transform group-hover:-rotate-6 transition-transform">
                      <Briefcase className="w-9 h-9" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Recruiter Portal</CardTitle>
                    <CardDescription className="text-slate-400 text-sm mt-1.5">
                      Sign in or create account with Google SSO or Email OTP verification.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 px-6 pb-6">
                    {/* Google SSO Button */}
                    <Button
                      size="lg"
                      className="w-full h-13 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold shadow-lg gap-3 transition-all"
                      onClick={() => handleGoogleLogin("recruiter")}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.32 7.23 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.5-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.83 0 12s.43 3.87 1.18 5.39l4.09-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.68 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
                      </svg>
                      Continue with Google SSO
                    </Button>

                    {/* Email with OTP Verification Button */}
                    <Button
                      size="lg"
                      className="w-full h-13 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-violet-600/30 gap-3 transition-all"
                      onClick={() => handleEmailOtpLogin("recruiter")}
                    >
                      <Mail className="w-5 h-5 text-violet-200" /> Register / Sign In with Email (OTP)
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-10 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl gap-2 text-xs"
                      onClick={() => handleDemoPreview("recruiter")}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Instant Recruiter Demo Preview
                    </Button>
                  </CardContent>

                  <CardFooter className="justify-center border-t border-slate-800/80 bg-slate-950/40 py-4">
                    <p className="text-xs text-slate-400">
                      Secure recruiter access with verified credentials.
                    </p>
                  </CardFooter>
                </Card>
              </motion.div>

            </div>

            {/* Footer Trust Bar */}
            <div className="mt-16 text-center text-xs text-slate-500 flex items-center justify-center gap-6">
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-indigo-400" /> Global Google SSO</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Email OTP Verification</span>
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> AI-Verified Trust Scores</span>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
