import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Briefcase, Zap } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { setRole, setDemoMode } = useAuthStore();
  const [, setLocation] = useLocation();

  const handleStudentLogin = () => {
    setDemoMode(false);
    setRole("student");
    setLocation("/sign-in");
  };

  const handleRecruiterLogin = () => {
    setDemoMode(false);
    setRole("recruiter");
    setLocation("/sign-in");
  };

  const handleRecruiterPreview = () => {
    setRole("recruiter");
    setDemoMode(true);
    setLocation("/recruiter");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full"
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
              Welcome to VERIF-AI
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              The trustworthy hiring platform where authenticated talent meets verified opportunities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Student Card */}
            <Card className="border-2 hover:border-primary/50 transition-colors shadow-md">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">For Students</CardTitle>
                <CardDescription className="text-base mt-2">
                  Build your verified profile and apply to top companies with confidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button 
                  size="lg" 
                  className="w-full text-lg h-14" 
                  onClick={handleStudentLogin}
                >
                  Student Login
                </Button>
              </CardContent>
              <CardFooter className="justify-center border-t bg-slate-50/50 mt-4 py-4">
                <p className="text-sm text-slate-600">
                  Don't have an account?{" "}
                  <Link href="/register/student" className="text-primary font-medium hover:underline">
                    Register as Student
                  </Link>
                </p>
              </CardFooter>
            </Card>

            {/* Recruiter Card */}
            <Card className="border-2 hover:border-primary/50 transition-colors shadow-md">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Briefcase className="w-8 h-8 text-slate-700" />
                </div>
                <CardTitle className="text-2xl">For Recruiters</CardTitle>
                <CardDescription className="text-base mt-2">
                  Hire verified talent faster with AI-powered profile analysis and trust scores.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="w-full text-lg h-14 border-2" 
                  onClick={handleRecruiterLogin}
                >
                  Recruiter Login
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full h-11 gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200"
                  onClick={handleRecruiterPreview}
                >
                  <Zap className="w-4 h-4" />
                  Preview Dashboard (Demo)
                </Button>
              </CardContent>
              <CardFooter className="justify-center border-t bg-slate-50/50 mt-4 py-4">
                <p className="text-sm text-slate-600">
                  Don't have an account?{" "}
                  <Link href="/register/recruiter" className="text-primary font-medium hover:underline">
                    Register as Recruiter
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
