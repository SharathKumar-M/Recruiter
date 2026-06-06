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
import { motion, AnimatePresence } from "framer-motion";
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
  Search
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
  if (score < 25) color = "text-red-500";
  else if (score < 50) color = "text-orange-500";
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
          transition={{ duration: 1.5, ease: "easeOut" }}
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
        <span className="text-xs font-medium text-slate-500">TRUST</span>
      </div>
    </div>
  );
};

export default function RecruiterDashboard() {
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: isStatsLoading } = useGetRecruiterStats();
  const { data: applications, isLoading: isAppsLoading } = useGetRecruiterApplications();

  const selectedApp = applications?.find(a => a.id === selectedAppId);
  const studentId = selectedApp?.studentId;

  const { data: student, isLoading: isStudentLoading } = useGetStudentForRecruiter(
    studentId || 0,
    { query: { enabled: !!studentId, queryKey: getGetStudentForRecruiterQueryKey(studentId || 0) } }
  );

  const { data: aiResult, isLoading: isAiLoading } = useGetAIResult(
    studentId || 0,
    { query: { enabled: !!studentId, queryKey: getGetAIResultQueryKey(studentId || 0) } }
  );

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
        toast.success("Analysis complete");
        queryClient.invalidateQueries({ queryKey: getGetAIResultQueryKey(studentId || 0) });
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
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
              <h4 className="text-2xl font-bold">{stats?.totalJobs || 0}</h4>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Applicants</p>
              <h4 className="text-2xl font-bold">{stats?.totalApplications || 0}</h4>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
              <h4 className="text-2xl font-bold">{stats?.pendingApplications || 0}</h4>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
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
        <Card className="w-1/3 flex flex-col min-h-0">
          <CardHeader className="py-4 px-4 border-b shrink-0 bg-slate-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> Recent Applications
            </CardTitle>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isAppsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
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
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
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
        <Card className="flex-1 flex flex-col min-h-0">
          {!selectedAppId || !student ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-slate-600">Select an applicant to view details</p>
            </div>
          ) : isStudentLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-6 border-b shrink-0 bg-slate-50/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900">{student.displayName}</h2>
                    <p className="text-slate-600 mt-1">Applying for: <span className="font-medium text-slate-900">{selectedApp?.job?.title}</span></p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500">Status:</span>
                    <Select value={selectedApp?.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className={`w-[140px] h-9 font-medium uppercase text-xs ${getStatusColor(selectedApp?.status || "")}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                <div className="px-6 pt-4 border-b shrink-0">
                  <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b-0 space-x-6 rounded-none">
                    <TabsTrigger 
                      value="analyzer" 
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-3 font-semibold data-[state=active]:text-indigo-600"
                    >
                      <BrainCircuit className="w-4 h-4 mr-2" /> AI Analyzer
                    </TabsTrigger>
                    <TabsTrigger 
                      value="profile" 
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 py-3 font-semibold data-[state=active]:text-indigo-600"
                    >
                      <FileText className="w-4 h-4 mr-2" /> Profile Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                  <TabsContent value="analyzer" className="m-0 h-full">
                    {!aiResult && !isAiLoading ? (
                      <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                          <BrainCircuit className="w-10 h-10 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Run AI Verification</h3>
                        <p className="text-slate-600 mb-8">
                          Analyze {student.displayName}'s profile, verify credentials, and cross-reference GitHub/LinkedIn data to generate a trust score.
                        </p>
                        <Button 
                          size="lg" 
                          onClick={handleAnalyze} 
                          disabled={analyzeMutation.isPending}
                          className="w-full text-lg shadow-lg"
                        >
                          {analyzeMutation.isPending ? "Analyzing Profile..." : "Analyze Now"}
                        </Button>
                      </div>
                    ) : isAiLoading || analyzeMutation.isPending ? (
                      <div className="h-full flex flex-col items-center justify-center">
                        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                        <p className="text-indigo-600 font-medium animate-pulse">Running Deep Analysis...</p>
                      </div>
                    ) : aiResult ? (
                      <div className="space-y-6">
                        <Card className="border-indigo-100 shadow-sm overflow-hidden">
                          <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
                            <div>
                              <h3 className="text-xl font-bold flex items-center gap-2 mb-1">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                AI Verification Report
                              </h3>
                              <p className="text-indigo-200 text-sm">
                                Generated {new Date(aiResult.analyzedAt).toLocaleString()}
                              </p>
                            </div>
                            <Badge className="bg-indigo-800 text-white hover:bg-indigo-800 border-indigo-700 uppercase tracking-widest px-3 py-1">
                              Verdict: {aiResult.verdict.replace("_", " ")}
                            </Badge>
                          </div>
                          
                          <div className="p-6 md:p-8 grid md:grid-cols-3 gap-8 items-center bg-white">
                            <div className="flex flex-col items-center justify-center border-r md:pr-8">
                              <TrustScoreCircle score={aiResult.trustScore} />
                              <p className="text-center text-sm text-slate-500 mt-4 max-w-[200px]">
                                Score based on credential validation and consistency checks.
                              </p>
                            </div>
                            
                            <div className="md:col-span-2 space-y-4">
                              <div>
                                <h4 className="font-bold text-slate-900 mb-2 uppercase text-xs tracking-wider text-indigo-600">Executive Summary</h4>
                                <p className="text-slate-700 leading-relaxed">
                                  {aiResult.summary}
                                </p>
                              </div>
                              
                              <div className="pt-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-900 mb-2 uppercase text-xs tracking-wider text-indigo-600">Recommendation</h4>
                                <p className="text-slate-900 font-medium">
                                  {aiResult.recommendation}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <div className="grid md:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader className="pb-3 border-b">
                              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                                <CheckCircle2 className="w-5 h-5" /> Verified Strengths
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <ul className="space-y-3">
                                {aiResult.strengths?.map((str, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>{str}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader className="pb-3 border-b">
                              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                                <AlertTriangle className="w-5 h-5" /> Red Flags & Concerns
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              {aiResult.redFlags && aiResult.redFlags.length > 0 ? (
                                <ul className="space-y-3">
                                  {aiResult.redFlags.map((flag, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                      <span>{flag}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-500 italic text-center py-4">No significant red flags detected.</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="profile" className="m-0 space-y-6">
                    <Card>
                      <CardHeader className="border-b bg-white">
                        <CardTitle className="text-lg">Contact & Links</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 bg-white grid sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm font-medium text-slate-500 mb-1">Email</p>
                          <p className="text-slate-900 font-medium">{student.email}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-500 mb-1">College</p>
                          <p className="text-slate-900 font-medium">{student.college || "Not provided"}</p>
                        </div>
                        
                        <div className="sm:col-span-2 flex flex-wrap gap-4 pt-4 border-t">
                          {student.linkedinUrl && (
                            <a href={student.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
                              <ExternalLink className="w-4 h-4" /> LinkedIn Profile
                            </a>
                          )}
                          {student.githubUrl && (
                            <a href={student.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline">
                              <ExternalLink className="w-4 h-4" /> GitHub Profile
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

                    <Card>
                      <CardHeader className="border-b bg-white">
                        <CardTitle className="text-lg">Skills</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 bg-white">
                        <div className="flex flex-wrap gap-2">
                          {student.skills?.map(skill => (
                            <Badge key={skill} variant="secondary" className="px-3 py-1 bg-slate-100 text-slate-700">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="border-b bg-white">
                        <CardTitle className="text-lg">Certificates</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 bg-white">
                        {student.certificates && student.certificates.length > 0 ? (
                          <div className="divide-y">
                            {student.certificates.map(cert => (
                              <div key={cert.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{cert.filename}</p>
                                    <p className="text-xs text-slate-500">Uploaded {new Date(cert.uploadedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                  <a href={cert.url} target="_blank" rel="noreferrer">View</a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-slate-500 italic">
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