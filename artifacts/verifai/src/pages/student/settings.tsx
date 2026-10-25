import { useState, useEffect } from "react";
import { User, Mail, Shield, Bell, Lock, LogOut, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/hooks/use-auth-store";
import { useGetStudentProfile } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function StudentSettings() {
  const { data: profile } = useGetStudentProfile();
  const { logout } = useAuthStore();
  const [, setLocation] = useLocation();

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [jobAlerts, setJobAlerts] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);

  const handleSavePreferences = () => {
    toast.success("Preferences saved successfully");
  };

  const handleSignOut = () => {
    logout();
    setLocation("/");
    toast.success("Signed out successfully");
  };

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8 space-y-8">
      <section>
        <p className="text-sm font-medium text-indigo-600">Preferences & Security</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-950">Student Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Manage your account information, privacy, and notification preferences.</p>
      </section>

      {/* Account Info */}
      <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-600" /> Account details
          </CardTitle>
          <CardDescription>Your verified Clerk account credentials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-slate-500">Full Name</Label>
              <Input value={profile?.displayName ?? ""} disabled className="mt-1.5 bg-slate-50 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Email Address</Label>
              <Input value={profile?.email ?? ""} disabled className="mt-1.5 bg-slate-50 rounded-xl" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-slate-500">Account Role</Label>
              <Input value={profile?.role ?? "student"} disabled className="mt-1.5 bg-slate-50 rounded-xl capitalize" />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Institution / College</Label>
              <Input value={profile?.college ?? "Not specified"} disabled className="mt-1.5 bg-slate-50 rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-600" /> Notification preferences
          </CardTitle>
          <CardDescription>Choose when and how you want to receive alerts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-slate-900">Email notifications</Label>
              <p className="text-xs text-slate-500">Receive emails when employers update your application status.</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-slate-900">Recommended job alerts</Label>
              <p className="text-xs text-slate-500">Get notified when new roles match your skillset.</p>
            </div>
            <Switch checked={jobAlerts} onCheckedChange={setJobAlerts} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium text-slate-900">Recruiter profile visibility</Label>
              <p className="text-xs text-slate-500">Allow verified recruiters to discover your profile and trust score.</p>
            </div>
            <Switch checked={profileVisible} onCheckedChange={setProfileVisible} />
          </div>

          <div className="pt-2 flex justify-end">
            <Button onClick={handleSavePreferences} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              Save preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security & Sign Out */}
      <Card className="border-rose-100 bg-rose-50/20 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-rose-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-rose-600" /> Session & Security
          </CardTitle>
          <CardDescription className="text-rose-700">Manage your active session on VERIF-AI.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Sign out of your active student session securely.</p>
          <Button variant="destructive" onClick={handleSignOut} className="rounded-xl gap-2 bg-rose-600 hover:bg-rose-700 text-white">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
