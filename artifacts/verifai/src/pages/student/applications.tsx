import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useGetMyApplications } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; detail: string; className: string }> = {
  pending: { label: "Submitted", detail: "Your application has been sent to the employer.", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  reviewed: { label: "Under Review", detail: "The employer has started reviewing your application.", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  shortlisted: { label: "Shortlisted", detail: "The employer has shortlisted your application for next steps.", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected: { label: "Rejected", detail: "The employer has closed this application.", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Submitted" },
  { value: "reviewed", label: "Under Review" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
];

interface AIResult {
  id: number;
  studentId: number;
  trustScore: number;
  verdict: string;
  summary: string;
  strengths: string[];
  redFlags: string[];
  analyzedAt: string;
}

export default function StudentApplications() {
  const { data: applications, isLoading, isError, refetch } = useGetMyApplications();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const fetchAiResult = useCallback(async () => {
    setAiLoading(true);
    setAiError(false);
    try {
      const res = await fetch("/api/student/ai-result");
      if (res.status === 404) {
        setAiResult(null);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load AI result");
      }
      const data = await res.json();
      setAiResult(data);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiResult();
  }, [fetchAiResult]);

  const sorted = useMemo(() => [...(applications ?? [])].sort((a, b) => +new Date(b.appliedAt) - +new Date(a.appliedAt)), [applications]);

  const filtered = sorted.filter((app) => {
    const matchesSearch = `${app.job?.title ?? ""} ${app.job?.company ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || app.status === status;
    return matchesSearch && matchesStatus;
  });

  const selected = sorted.find((app) => app.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const total = sorted.length;
    const pending = sorted.filter((a) => a.status === "pending").length;
    const reviewed = sorted.filter((a) => a.status === "reviewed").length;
    const shortlisted = sorted.filter((a) => a.status === "shortlisted").length;
    const rejected = sorted.filter((a) => a.status === "rejected").length;
    return { total, pending, reviewed, shortlisted, rejected };
  }, [sorted]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <section className="mb-8">
          <p className="text-sm font-medium text-indigo-600">Application tracker</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">My applications</h2>
        </section>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5 mb-8">
          {[1, 2, 3, 4].map(() => (
            <Card key={String(Math.random())} className="border-slate-200 shadow-none">
              <CardContent className="p-4 md:p-5">
                <p className="text-xs font-medium text-slate-500">Loading…</p>
                <Skeleton className="mt-3 h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="mt-8">
          <div className="space-y-3">
            {[1, 2, 3].map(() => (
              <Skeleton key={String(Math.random())} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <section className="mb-8">
          <p className="text-sm font-medium text-indigo-600">Application tracker</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">My applications</h2>
        </section>
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-slate-400 mb-3" />
            <h3 className="mt-3 font-semibold">We couldn't load your applications</h3>
            <p className="mt-1 text-sm text-slate-500">Check your connection and try again.</p>
            <Button onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <section className="mb-8">
        <p className="text-sm font-medium text-indigo-600">Application tracker</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">My applications</h2>
        <p className="mt-2 text-slate-600">Follow the progress of every role you have applied for.</p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5 mb-8">
        <StatCard label="Total applications" value={counts.total} tone="text-indigo-700" bg="bg-indigo-50" />
        <StatCard label="Submitted" value={counts.pending} tone="text-amber-700" bg="bg-amber-50" />
        <StatCard label="Under review" value={counts.reviewed} tone="text-blue-700" bg="bg-blue-50" />
        <StatCard label="Shortlisted" value={counts.shortlisted} tone="text-emerald-700" bg="bg-emerald-50" />
        <StatCard label="Rejected" value={counts.rejected} tone="text-rose-700" bg="bg-rose-50" />
      </section>

      <section className="mb-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search job title or company"
              className="bg-white pl-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm text-slate-600 shrink-0">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 shrink-0"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        {filtered.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {filtered.map((app) => (
              <ApplicationCard key={app.id} app={app} onOpen={() => setSelectedId(app.id)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={search || status !== "all" ? "No applications match your filters" : "No applications yet"}
            detail={
              search || status !== "all"
                ? "Try changing your search or status filter."
                : "When you apply for a role, it will appear here."
            }
            action={!search && status === "all" ? (
              <Button asChild>
                <Link href="/jobs">Find jobs</Link>
              </Button>
            ) : undefined}
          />
        )}
      </section>

      <ApplicationDialog
        application={selected}
        aiResult={aiResult}
        aiLoading={aiLoading}
        aiError={aiError}
        onRetry={fetchAiResult}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  bg,
}: {
  label: string;
  value: number;
  tone: string;
  bg: string;
}) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardContent className="p-4 md:p-5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
        <div className={`mt-3 h-1 rounded-full ${bg}`} />
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-12 text-center">
        <BriefcaseBusiness className="mx-auto h-9 w-9 text-slate-400 mb-3" />
        <h3 className="mt-3 font-semibold">{title}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detail}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}

function ApplicationCard({ app, onOpen }: { app: any; onOpen: () => void }) {
  const meta = STATUS_LABELS[app.status] ?? {
    label: app.status,
    detail: "Application status updated.",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  const missingJob = !app.job;

  return (
    <div
      className="grid gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,2fr)_1fr_140px_120px] md:items-center md:gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
      onClick={onOpen}
      role="button"
      tabIndex={0}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-950">
          {missingJob ? "Job no longer available" : app.job?.title ?? "Unknown role"}
        </p>
        <p className="mt-1 truncate text-sm text-slate-500">
          {missingJob ? "This listing is unavailable" : app.job?.company ?? "Unknown company"}
        </p>
        {!missingJob && app.job?.location && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5" /> {app.job.location} &middot; {app.job.jobType}
          </p>
        )}
      </div>
      <p className="flex items-center gap-1 text-sm text-slate-600">
        <CalendarDays className="h-4 w-4 text-slate-400" />{" "}
        {new Date(app.appliedAt).toLocaleDateString()}
      </p>
      <Badge className={`h-fit w-fit border-0 ring-1 ${meta.className}`}>{meta.label}</Badge>
      <Button variant="outline" size="sm" className="shrink-0">
        Details
      </Button>
    </div>
  );
}

function ApplicationDialog({
  application,
  aiResult,
  aiLoading,
  aiError,
  onRetry,
  onOpenChange,
}: {
  application: any;
  aiResult: AIResult | null;
  aiLoading: boolean;
  aiError: boolean;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!application) return null;
  const meta = STATUS_LABELS[application.status] ?? {
    label: application.status,
    detail: "Application status updated.",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  const missingJob = !application.job;

  return (
    <Dialog open={Boolean(application)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl p-6 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="pr-7 text-xl">
            {missingJob ? "Application details" : application.job?.title ?? "Application details"}
          </DialogTitle>
          <DialogDescription>
            {missingJob ? "Listing unavailable" : application.job?.company ?? "Unknown company"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current status</p>
            <Badge className={`mt-2 border-0 ring-1 ${meta.className}`}>{meta.label}</Badge>
            <p className="mt-2 text-sm text-slate-700">{meta.detail}</p>
          </div>
          <div className="grid gap-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-950">Applied:</span>{" "}
              {new Date(application.appliedAt).toLocaleString()}
            </p>
            {!missingJob && application.job && (
              <>
                <p>
                  <span className="font-medium text-slate-950">Location:</span>{" "}
                  {application.job.location}
                </p>
                <p>
                  <span className="font-medium text-slate-950">Work type:</span>{" "}
                  {application.job.jobType}
                </p>
                {application.job.salary && (
                  <p>
                    <span className="font-medium text-slate-950">Salary:</span>{" "}
                    {application.job.salary}
                  </p>
                )}
              </>
            )}
          </div>

          {aiResult && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI profile assessment</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-indigo-900">Trust score</span>
                  <span className="text-sm font-bold text-indigo-700">{aiResult.trustScore}</span>
                </div>
                <p className="text-xs text-indigo-700">{aiResult.summary}</p>
              </div>
            </div>
          )}

          {!missingJob && application.job && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                View original listing
              </p>
              <Button asChild variant="outline" className="w-full" size="sm">
                <Link href={`/jobs?job=${application.jobId}`}>
                  View job details <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          <p className="text-xs leading-5 text-slate-500">
            <Clock3 className="h-4 w-4 shrink-0" />{" "}
            The latest available update is the current application status above. Recruiter notes and
            other candidate information are private.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
