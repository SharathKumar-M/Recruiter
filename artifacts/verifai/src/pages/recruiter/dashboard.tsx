import { useState } from "react";
import {
  useGetRecruiterStats,
  useGetRecruiterApplications,
  useGetStudentForRecruiter,
  useUpdateApplicationStatus,
  useGetAIResult,
  useAnalyzeStudent,
  getGetRecruiterApplicationsQueryKey,
  getGetStudentForRecruiterQueryKey,
  getGetAIResultQueryKey,
  getGetRecruiterStatsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ChevronRight,
  BrainCircuit,
  Search,
  RefreshCw,
  Info,
  FileCheck,
  Sparkles,
  Layers,
  HelpCircle
} from "lucide-react";

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "pending": return "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200";
    case "reviewed": return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
    case "shortlisted": return "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200";
    case "rejected": return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
    default: return "bg-slate-100 text-slate-800 hover:bg-slate-200";
  }
};

const TrustScoreCircle = ({ score }: { score: number }) => {
  let color = "text-emerald-500";
  if (score < 30) color = "text-red-500";
  else if (score < 60) color = "text-orange-500";
  else if (score < 75) color = "text-amber-500";

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-slate-100"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          cx="50"
          cy="50"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{score}</span>
        <span className="text-[10px] font-semibold text-slate-500 tracking-wider">TRUST</span>
      </div>
    </div>
  );
};

export default function RecruiterDashboard() {
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: stats } = useGetRecruiterStats();
  const { data: applications, isLoading: isAppsLoading } = useGetRecruiterApplications();

  const selectedApp = applications?.find(a => a.id === selectedAppId);
  const studentId = selectedApp?.studentId;

  const { data: student, isLoading: isStudentLoading } = useGetStudentForRecruiter(
    studentId || 0,
    { query: { enabled: !!studentId, queryKey: getGetStudentForRecruiterQueryKey(studentId || 0) } }
  );

  const { data: aiResultData, isLoading: isAiLoading, refetch: refetchAI } = useGetAIResult(
    studentId || 0,
    { query: { enabled: !!studentId, queryKey: getGetAIResultQueryKey(studentId || 0) } }
  );

  const aiResult = aiResultData as any;

  const statusMutation = useUpdateApplicationStatus({
    mutation: {
      onSuccess: () => {
        toast.success("Status updated");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterApplicationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecruiterStatsQueryKey() });
      }
    }
  });

  const analyzeMutation = useAnalyzeStudent({
    mutation: {
      onSuccess: () => {
        toast.success("AI Verification completed successfully");
        if (studentId) {
          queryClient.invalidateQueries({ queryKey: getGetAIResultQueryKey(studentId) });
          refetchAI();
        }
      },
      onError: (err: any) => {
        const msg = err?.data?.details || err?.data?.error || err?.message || "AI Analysis failed";
        toast.error(`Verification error: ${msg}`);
      }
    }
  });

  const handleStatusChange = (status: string) => {
    if (selectedAppId) {
      statusMutation.mutate({
        applicationId: selectedAppId,
        data: { status }
      });
    }
  };

  const handleAnalyze = () => {
    if (studentId) {
      analyzeMutation.mutate({ studentId });
    }
  };

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8 flex flex-col h-[calc(100vh-64px)]">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
              <h4 className="text-2xl font-bold">{stats?.totalJobs || 0}</h4>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Applicants</p>
              <h4 className="text-2xl font-bold">{stats?.totalApplications || 0}</h4>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
              <h4 className="text-2xl font-bold">{stats?.pendingApplications || 0}</h4>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Shortlisted</p>
              <h4 className="text-2xl font-bold">{stats?.shortlistedApplications || 0}</h4>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Left Panel: Applicants List */}
        <Card className="w-1/3 flex flex-col min-h-0 rounded-2xl shadow-sm">
          <CardHeader className="py-4 px-4 border-b shrink-0 bg-slate-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> Recent Applications
            </CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isAppsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))
            ) : applications?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                <FileText className="w-12 h-12 mb-2 opacity-20" />
                <p>No applications found</p>
              </div>
            ) : (
              applications?.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedAppId(app.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedAppId === app.id
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-slate-900">{app.student?.displayName}</span>
                    <Badge variant="outline" className={`text-[10px] uppercase ${getStatusColor(app.status)}`}>
                      {app.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600 truncate mb-1">
                    {app.job?.title}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(app.appliedAt).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Right Panel: Details */}
        <Card className="flex-1 flex flex-col min-h-0 rounded-2xl shadow-sm">
          {!selectedAppId || !student ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-slate-600">Select an applicant to view verification details</p>
            </div>
          ) : isStudentLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-1/3 rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-6 border-b shrink-0 bg-slate-50/50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{student.displayName}</h2>
                    <p className="text-slate-600 text-sm mt-0.5">
                      Applying for: <span className="font-semibold text-slate-900">{selectedApp?.job?.title}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
                    <Select value={selectedApp?.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className={`w-[140px] h-9 font-medium uppercase text-xs rounded-xl ${getStatusColor(selectedApp?.status || "")}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="REVIEWED">Reviewed</SelectItem>
                        <SelectItem value="SHORTLISTED">Shortlisted</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="analyzer" className="flex-1 flex flex-col min-h-0">
                <div className="px-6 pt-3 border-b shrink-0 bg-white">
                  <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b-0 space-x-6 rounded-none">
                    <TabsTrigger
                      value="analyzer"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-3 font-semibold data-[state=active]:text-indigo-600 cursor-pointer"
                    >
                      <BrainCircuit className="w-4 h-4 mr-2" /> AI Analyzer
                    </TabsTrigger>
                    <TabsTrigger
                      value="profile"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-3 font-semibold data-[state=active]:text-indigo-600 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mr-2" /> Profile & Documents
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                  <TabsContent value="analyzer" className="m-0 h-full">
                    {!aiResult && !isAiLoading && !analyzeMutation.isPending ? (
                      <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
                        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                          <BrainCircuit className="w-10 h-10 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Run AI Verification</h3>
                        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                          Extract and analyze {student.displayName}'s actual resume text, verify public GitHub repository activity, and inspect platform claims.
                        </p>

                        {analyzeMutation.isError && (
                          <div className="mb-6 w-full p-4 rounded-xl border border-amber-300 bg-amber-50 text-left text-xs text-amber-900 space-y-1">
                            <p className="font-semibold flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              Verification Service Notice
                            </p>
                            <p className="leading-relaxed">
                              {(analyzeMutation.error as any)?.data?.error ||
                                (analyzeMutation.error as any)?.data?.details ||
                                (analyzeMutation.error as any)?.message ||
                                "Gemini AI model is temporarily busy. Please try again."}
                            </p>
                          </div>
                        )}

                        <Button
                          size="lg"
                          onClick={handleAnalyze}
                          disabled={analyzeMutation.isPending}
                          className="w-full text-base rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg cursor-pointer gap-2"
                        >
                          <Sparkles className="w-4 h-4" /> Start AI Verification
                        </Button>
                      </div>
                    ) : isAiLoading || analyzeMutation.isPending ? (
                      <div className="h-full flex flex-col items-center justify-center py-12">
                        <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-indigo-700 font-semibold text-base animate-pulse">Running In-Depth Verification...</p>
                        <p className="text-slate-500 text-xs mt-1">Analyzing resume text, GitHub repos, and credentials</p>
                      </div>
                    ) : aiResult ? (
                      <div className="space-y-6">
                        {/* Report Header Card */}
                        <Card className="border-indigo-100 shadow-sm rounded-2xl overflow-hidden bg-white">
                          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                  Verification Report
                                </h3>
                                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-[10px] uppercase font-semibold">
                                  {aiResult.analysisProvider?.toUpperCase() || "AI"} Engine
                                </Badge>
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] uppercase font-semibold">
                                  {aiResult.analysisMode || "ai-verified"}
                                </Badge>
                              </div>
                              <p className="text-slate-400 text-xs">
                                Analyzed on {new Date(aiResult.analyzedAt).toLocaleString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <Badge className="bg-white/10 text-white border-white/20 uppercase tracking-wider text-xs px-3 py-1 font-bold">
                                Verdict: {aiResult.verdict?.replace("_", " ")}
                              </Badge>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAnalyze}
                                disabled={analyzeMutation.isPending}
                                className="rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs gap-1.5 cursor-pointer"
                                title="Re-run verification with latest data"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${analyzeMutation.isPending ? "animate-spin" : ""}`} />
                                Re-run Analysis
                              </Button>
                            </div>
                          </div>

                          <div className="p-6 md:p-8 grid md:grid-cols-3 gap-8 items-center bg-white">
                            <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r pb-6 md:pb-0 md:pr-8">
                              <TrustScoreCircle score={aiResult.trustScore} />
                              <p className="text-center text-xs text-slate-500 mt-3 max-w-[200px] leading-relaxed">
                                Objective confidence score derived from verifiable resume text, GitHub activity, and credentials.
                              </p>
                            </div>

                            <div className="md:col-span-2 space-y-4">
                              <div>
                                <h4 className="font-bold text-indigo-600 mb-1.5 uppercase text-xs tracking-wider flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5" /> Executive Summary
                                </h4>
                                <p className="text-slate-700 leading-relaxed text-sm">
                                  {aiResult.executiveSummary || aiResult.summary}
                                </p>
                              </div>

                              <div className="pt-3 border-t border-slate-100">
                                <h4 className="font-bold text-indigo-600 mb-1.5 uppercase text-xs tracking-wider flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Recruiter Recommendation
                                </h4>
                                <p className="text-slate-900 font-medium text-sm">
                                  {aiResult.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Verified Strengths & Red Flags */}
                        <div className="grid md:grid-cols-2 gap-6">
                          <Card className="rounded-2xl border-slate-200">
                            <CardHeader className="pb-3 border-b bg-emerald-50/30">
                              <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Verified Strengths
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <ul className="space-y-2.5">
                                {(aiResult.verifiedStrengths || aiResult.strengths)?.map((str: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                                    <ChevronRight className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>{str}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card className="rounded-2xl border-slate-200">
                            <CardHeader className="pb-3 border-b bg-rose-50/30">
                              <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-800">
                                <AlertTriangle className="w-4 h-4 text-rose-600" /> Concerns & Missing Info
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                              {aiResult.redFlags && aiResult.redFlags.length > 0 && (
                                <ul className="space-y-2">
                                  {aiResult.redFlags.map((flag: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-rose-700">
                                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                      <span>{flag}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {aiResult.missingInformation && aiResult.missingInformation.length > 0 && (
                                <div className="pt-2 border-t border-slate-100">
                                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unverified claims:</p>
                                  <ul className="space-y-1.5">
                                    {aiResult.missingInformation.map((info: string, i: number) => (
                                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                        <span className="text-slate-400">•</span>
                                        <span>{info}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(!aiResult.redFlags || aiResult.redFlags.length === 0) &&
                               (!aiResult.missingInformation || aiResult.missingInformation.length === 0) && (
                                <p className="text-xs text-slate-500 italic py-2">No red flags or conflicting information detected.</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Detailed Assessment Grid */}
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* GitHub Assessment */}
                          <Card className="rounded-2xl border-slate-200">
                            <CardHeader className="pb-3 border-b">
                              <CardTitle className="text-sm font-bold flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-indigo-600" /> GitHub Code Verification
                                </span>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {aiResult.githubCheck?.status || "Unverified"}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-2 text-xs text-slate-700">
                              <p className="leading-relaxed">{aiResult.githubCheck?.detail}</p>
                              {aiResult.githubCheck?.publicRepos !== undefined && (
                                <div className="flex gap-4 pt-2 font-mono text-[11px] text-slate-600">
                                  <span>Public Repos: <strong className="text-slate-900">{aiResult.githubCheck.publicRepos}</strong></span>
                                  <span>Followers: <strong className="text-slate-900">{aiResult.githubCheck.followers ?? 0}</strong></span>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Resume Document Assessment */}
                          <Card className="rounded-2xl border-slate-200">
                            <CardHeader className="pb-3 border-b">
                              <CardTitle className="text-sm font-bold flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <FileCheck className="w-4 h-4 text-indigo-600" /> Resume Document Inspection
                                </span>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {aiResult.resumeAssessment?.status?.replace(/_/g, " ") || "Inspected"}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-2 text-xs text-slate-700">
                              <p className="leading-relaxed">{aiResult.resumeAssessment?.detail}</p>
                              {selectedApp?.student?.resumeUrl && (
                                <div className="pt-2">
                                  <a
                                    href={selectedApp.student.resumeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-indigo-600 font-semibold hover:underline"
                                  >
                                    View uploaded resume file <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Transparency & Evidence Disclaimer */}
                        <Card className="rounded-2xl border-indigo-100 bg-indigo-50/40 p-4">
                          <div className="flex items-start gap-3">
                            <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-600 space-y-1">
                              <p className="font-semibold text-slate-900">Evidence Sources & Transparency</p>
                              <p>
                                <strong>Sources:</strong> {(aiResult.evidenceSources || []).join(", ") || "Resume text, GitHub public API, self-reported profile data"}.
                              </p>
                              <p>
                                <strong>Limitations:</strong> {(aiResult.limitations || []).join(" ") || "External private credentials like LinkedIn are not independently accessible and require interview confirmation."}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="profile" className="m-0 space-y-6">
                    <Card className="rounded-2xl">
                      <CardHeader className="border-b bg-white">
                        <CardTitle className="text-base font-bold">Contact & Verified Links</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 bg-white grid sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Email</p>
                          <p className="text-slate-900 font-medium text-sm">{student.email}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Institution / College</p>
                          <p className="text-slate-900 font-medium text-sm">{student.college || "Not provided"}</p>
                        </div>

                        <div className="sm:col-span-2 flex flex-wrap gap-4 pt-4 border-t">
                          {selectedApp?.student?.resumeUrl && (
                            <a href={selectedApp.student.resumeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
                              <FileCheck className="w-4 h-4" /> Download Resume Document ({selectedApp.student.resumeFilename || "File"})
                            </a>
                          )}
                          {student.githubUrl && (
                            <a href={student.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
                              <ExternalLink className="w-4 h-4" /> GitHub Profile
                            </a>
                          )}
                          {student.linkedinUrl && (
                            <a href={student.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
                              <ExternalLink className="w-4 h-4" /> LinkedIn Profile
                            </a>
                          )}
                          {student.portfolioUrl && (
                            <a href={student.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
                              <ExternalLink className="w-4 h-4" /> Portfolio
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="border-b bg-white">
                        <CardTitle className="text-base font-bold">Documented Skills</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 bg-white">
                        <div className="flex flex-wrap gap-2">
                          {student.skills && student.skills.length > 0 ? (
                            student.skills.map((skill: string) => (
                              <Badge key={skill} variant="secondary" className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs">
                                {skill}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No skills documented yet.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader className="border-b bg-white">
                        <CardTitle className="text-base font-bold">Certificates & Credentials</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 bg-white">
                        {student.certificates && student.certificates.length > 0 ? (
                          <div className="divide-y">
                            {student.certificates.map((cert: any) => (
                              <div key={cert.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900 text-sm">{cert.filename}</p>
                                    <p className="text-xs text-slate-500">Uploaded {new Date(cert.uploadedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <Button variant="outline" size="sm" asChild className="rounded-xl">
                                  <a href={cert.url} target="_blank" rel="noreferrer">View file</a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-slate-500 text-xs italic">
                            No certificates uploaded
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
