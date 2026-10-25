import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Search, Sparkles, UserRound, Building2, Users, CalendarDays, ExternalLink, Clock3, Check } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useApplyToJob, useGetMyApplications, useGetStudentProfile, useGetStudentStats, useListJobs, getGetMyApplicationsQueryKey, getGetStudentStatsQueryKey, getListJobsQueryKey, type Job } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const statusClass: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  reviewed: "bg-blue-50 text-blue-700 ring-blue-200",
  shortlisted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function StudentHome() {
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("search") ?? "");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetStudentStats();
  const { data: profile } = useGetStudentProfile();
  const { data: applications, isLoading: appsLoading } = useGetMyApplications();
  const { data: jobs, isLoading: jobsLoading, isError: jobsError } = useListJobs({ search: search || undefined });

  const appliedIds = useMemo(() => new Set((applications ?? []).map((app) => app.jobId)), [applications]);
  const recommended = (jobs ?? []).filter((job) => !appliedIds.has(job.id)).slice(0, 6);

  const missing = [
    !profile?.college && "College/University",
    !(profile?.skills?.length) && "Skills",
    !profile?.resumeUrl && "Resume",
    !profile?.linkedinUrl && "LinkedIn profile",
    !profile?.githubUrl && "GitHub profile"
  ].filter(Boolean) as string[];

  const applyMutation = useApplyToJob({
    mutation: {
      onSuccess: () => {
        toast.success("Application submitted successfully");
        setSelectedJob(null);
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStudentStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyApplicationsQueryKey() });
      },
      onError: () => toast.error("We couldn't submit that application. Please try again.")
    }
  });

  const firstName = profile?.displayName?.split(" ")[0] || "there";
  const statsCards = [
    ["Jobs applied", stats?.totalApplications ?? 0, "text-indigo-700", "bg-indigo-50"],
    ["Under review", stats?.pendingApplications ?? 0, "text-amber-700", "bg-amber-50"],
    ["Shortlisted", stats?.shortlistedApplications ?? 0, "text-emerald-700", "bg-emerald-50"],
    ["Profile complete", stats ? `${stats.profileCompletion}%` : "—", "text-violet-700", "bg-violet-50"]
  ] as const;

  const handleApply = (jobId: number) => {
    applyMutation.mutate({ jobId });
  };

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8 space-y-8">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-8 text-white shadow-md md:px-10 md:py-10">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30 mb-3">
              <Sparkles className="h-3.5 w-3.5" /> Student Workspace
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back, {firstName}.</h2>
            <p className="mt-2 text-slate-300 text-sm md:text-base leading-relaxed">
              Explore active roles matched to your verified skills and track your recruiter interactions in one seamless dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-950 hover:bg-indigo-50 font-medium shadow-sm">
              <a href="#recommended">
                Find jobs <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" className="border-slate-700 bg-slate-900/50 text-white hover:bg-slate-800">
              <Link href="/profile">Edit profile</Link>
            </Button>
          </div>
        </div>
      </section>

      {statsError && (
        <Card className="border-amber-200 bg-amber-50/80 shadow-none">
          <CardContent className="p-4 text-sm text-amber-800">
            Some statistics could not be loaded from the server. You can still browse active listings below.
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {statsCards.map(([label, value, text, bg]) => (
          <Card key={label} className="border-slate-200/80 shadow-sm hover:shadow transition-all bg-white rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
              {statsLoading ? (
                <Skeleton className="mt-3 h-8 w-16 rounded-md" />
              ) : (
                <p className={`mt-2 text-3xl font-bold tracking-tight ${text}`}>{value}</p>
              )}
              <div className={`mt-4 h-1.5 w-full rounded-full ${bg}`} />
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Main Content Grid */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Recommended Jobs */}
        <section id="recommended" className="space-y-4 scroll-mt-24">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">Recommended jobs</h2>
              <p className="text-sm text-slate-500">Handpicked active opportunities matching your profile.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles or skills..."
                className="pl-9 bg-white border-slate-200 h-9 rounded-xl"
              />
            </div>
          </div>

          {jobsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          ) : jobsError ? (
            <EmptyState text="Jobs are temporarily unavailable. Please refresh and try again." />
          ) : recommended.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {recommended.map((job, index) => {
                const initials = job.company.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
                const isApplied = appliedIds.has(job.id);
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card className="h-full border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-2xl bg-white flex flex-col">
                      <CardContent className="p-6 flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-950 truncate hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => setSelectedJob(job)}>
                                {job.title}
                              </h3>
                              <p className="text-sm text-slate-600">{job.company}</p>
                            </div>
                          </div>
                          {isApplied && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-0 ring-1 ring-emerald-200 text-xs">
                              <Check className="mr-1 h-3 w-3" /> Applied
                            </Badge>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" /> {job.location}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">{job.jobType}</span>
                          {job.salary && <span className="font-medium text-slate-700">{job.salary}</span>}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-1.5 flex-1">
                          {(job.skills ?? []).slice(0, 3).map((skill) => (
                            <Badge key={skill} variant="secondary" className="bg-slate-100/80 text-slate-700 text-xs font-normal">
                              {skill}
                            </Badge>
                          ))}
                          {(job.skills ?? []).length > 3 && (
                            <span className="text-xs text-slate-400 self-center">+{(job.skills ?? []).length - 3} more</span>
                          )}
                        </div>

                        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                          <span className="text-xs text-slate-400">Posted {new Date(job.postedAt).toLocaleDateString()}</span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs font-medium" onClick={() => setSelectedJob(job)}>
                              Details
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-xl h-8 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
                              disabled={isApplied || applyMutation.isPending}
                              onClick={() => handleApply(job.id)}
                            >
                              {isApplied ? "Applied" : "Apply now"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No matching active jobs right now. Try adjusting your search query." />
          )}

          {recommended.length > 0 && (
            <div className="pt-2 flex justify-center">
              <Button asChild variant="outline" className="rounded-xl border-slate-200">
                <Link href="/jobs">View all active listings ({jobs?.length ?? 0}) <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          )}
        </section>

        {/* Sidebar Widgets */}
        <aside className="space-y-6">
          {/* Profile Progress Card */}
          <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-semibold text-slate-950">Profile completion</h3>
                </div>
                <span className="text-sm font-bold text-indigo-600">{stats?.profileCompletion ?? 0}%</span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${stats?.profileCompletion ?? 0}%` }}
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                {missing.length
                  ? `Complete your ${missing.slice(0, 2).join(" and ")} to stand out to top recruiters.`
                  : "Your core profile fields are complete."}
              </p>

              <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-xl text-xs font-medium border-slate-200">
                <Link href="/profile">
                  Manage profile <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* AI Career Insights Teaser */}
          <Card className="border-violet-100 bg-gradient-to-br from-violet-50/60 to-indigo-50/30 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-violet-700">
                <Sparkles className="h-4 w-4" />
                <h3 className="font-semibold text-slate-950">AI Career Insights</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Generate personalized career guidance, skill gap analysis, and tailored project ideas based on your portfolio.
              </p>
              <Button asChild size="sm" className="mt-4 w-full rounded-xl text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white">
                <Link href="/insights">
                  Explore AI insights <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Applications Card */}
          <Card className="border-slate-200/80 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-950">Recent applications</h3>
                  <p className="text-xs text-slate-500">Your latest tracking status</p>
                </div>
                <Link href="/applications" className="text-xs font-medium text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>

              {appsLoading ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : (applications ?? []).length ? (
                <div className="space-y-2.5 pt-1">
                  {(applications ?? []).slice(0, 3).map((app) => (
                    <Link
                      key={app.id}
                      href="/applications"
                      className="block rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {app.job?.title ?? "Application"}
                        </p>
                        <Badge className={`border-0 text-[10px] capitalize ring-1 ${statusClass[app.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                          {app.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 truncate">{app.job?.company ?? "Company"}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200">
                  No applications submitted yet.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Job Details Dialog */}
      <Dialog open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJob(null)}>
        {selectedJob && (
          <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl p-6 sm:p-8">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 text-base">
                  {selectedJob.company.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-950">{selectedJob.title}</DialogTitle>
                  <DialogDescription className="text-sm font-medium text-slate-600">
                    {selectedJob.company} &middot; {selectedJob.location}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 font-medium">{selectedJob.jobType}</span>
                {selectedJob.salary && <span className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 font-medium">{selectedJob.salary}</span>}
                <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1">Posted {new Date(selectedJob.postedAt).toLocaleDateString()}</span>
              </div>

              <div>
                <h3 className="font-semibold text-slate-950 text-sm mb-2">Role description</h3>
                <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-200/60">
                  {selectedJob.description}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-950 text-sm mb-2">Required skills</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedJob.skills ?? []).length ? (
                    selectedJob.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="bg-slate-100 text-slate-800 text-xs">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No specific skills listed.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setSelectedJob(null)} className="rounded-xl">
                  Close
                </Button>
                <Button
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={appliedIds.has(selectedJob.id) || applyMutation.isPending}
                  onClick={() => handleApply(selectedJob.id)}
                >
                  {appliedIds.has(selectedJob.id) ? "Already applied" : "Apply to this role"}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed border-slate-200 rounded-2xl bg-white shadow-none">
      <CardContent className="p-12 text-center">
        <BriefcaseBusiness className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 font-semibold text-slate-900">Nothing to show</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{text}</p>
      </CardContent>
    </Card>
  );
}
