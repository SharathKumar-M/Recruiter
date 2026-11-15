import { useMemo, useState } from "react";
import { AlertCircle, Bot, BrainCircuit, CheckCircle2, CircleAlert, FileText, Lightbulb, RefreshCw, Sparkles, Target, Compass, Video, BookOpen, Layers, ExternalLink, Clock } from "lucide-react";
import { useGenerateStudentInsights, useGetStudentProfile, useListJobs } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentInsights() {
  const { data: profile, isLoading: profileLoading } = useGetStudentProfile();
  const { data: jobs } = useListJobs({});
  const [jobId, setJobId] = useState<string>("");
  const insights = useGenerateStudentInsights();
  const missing = useMemo(() => [!profile?.college && "your education", !(profile?.skills?.length) && "documented skills", !profile?.linkedinUrl && "a LinkedIn profile", !profile?.githubUrl && "a GitHub profile", !profile?.portfolioUrl && "a portfolio", !profile?.resumeUrl && "a résumé"].filter(Boolean) as string[], [profile]);
  const generate = () => insights.mutate({ data: jobId ? { jobId: Number(jobId) } : undefined });
  const data = insights.data as any;

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8 space-y-8">
      <section className="rounded-3xl bg-gradient-to-r from-indigo-900 via-slate-900 to-violet-950 px-6 py-10 text-white md:px-10 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/30">
              <Sparkles className="h-3.5 w-3.5" /> {data?.analysisProvider ? `${data.analysisProvider.toUpperCase()} AI Powered` : "Gemini & OpenAI Configurable AI"}
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">AI Career Insights & Roadmap</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Personalized career guidance, missing stack analysis across your resume, GitHub & LinkedIn, curated YouTube tutorials, and step-by-step roadmaps.
            </p>
          </div>
          <Button
            onClick={generate}
            disabled={insights.isPending || profileLoading}
            size="lg"
            className="rounded-2xl bg-white text-slate-950 hover:bg-indigo-50 shadow-lg font-semibold gap-2 transition-all hover:scale-[1.02]"
          >
            {insights.isPending ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 text-indigo-600" />}
            {data ? "Regenerate Insights" : "Generate AI Insights"}
          </Button>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-8">
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Target className="h-5 w-5 text-indigo-600" /> Target Job & Role Context
              </CardTitle>
              <CardDescription>Select a target role to compare your stack and get tailored skill gap analysis.</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="text-sm font-medium text-slate-700">
                Target job listing
                <select
                  value={jobId}
                  disabled={insights.isPending}
                  onChange={(event) => setJobId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">No job selected — general career roadmap & stack guidance</option>
                  {(jobs ?? []).map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} · {job.company}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                AI analyzes overlap between job requirements and your student profile, resume, GitHub, LinkedIn, and certificates.
              </p>
            </CardContent>
          </Card>

          {insights.isPending && (
            <div className="space-y-6">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
          )}

          {insights.isError && (() => {
            const errorObj = insights.error as any;
            const errorStatus = errorObj?.status || errorObj?.data?.statusCode;
            const is503 = errorStatus === 503 || String(errorObj?.data?.details || "").includes("503") || String(errorObj?.data?.error || "").includes("high demand");
            const errorMessage = errorObj?.data?.error || (is503 ? "Gemini AI model is temporarily in high demand." : "AI generation encountered an error.");
            const errorDetails = errorObj?.data?.details || errorObj?.message;

            return (
              <Card className={`rounded-2xl border ${is503 ? "border-amber-300 bg-amber-50/80" : "border-rose-200 bg-rose-50"}`}>
                <CardContent className="flex gap-4 p-6">
                  {is503 ? (
                    <Clock className="h-6 w-6 shrink-0 text-amber-600 mt-0.5 animate-pulse" />
                  ) : (
                    <AlertCircle className="h-6 w-6 shrink-0 text-rose-700 mt-0.5" />
                  )}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-bold text-base ${is503 ? "text-amber-900" : "text-rose-900"}`}>
                        {is503 ? "Gemini AI Model Temporarily Busy" : "AI Service Notice"}
                      </h3>
                      {is503 && (
                        <Badge className="bg-amber-200 text-amber-900 border-amber-300 text-[10px] uppercase font-mono">
                          HTTP 503: High Demand
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${is503 ? "text-amber-900" : "text-rose-800"}`}>
                      {errorMessage}
                    </p>
                    {errorDetails && errorDetails !== errorMessage && (
                      <p className={`text-xs font-mono p-2 rounded-lg break-words ${is503 ? "bg-amber-100/60 text-amber-800" : "bg-rose-100/60 text-rose-800"}`}>
                        {errorDetails}
                      </p>
                    )}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={insights.isPending}
                        className={`rounded-xl gap-2 font-medium cursor-pointer shadow-sm ${
                          is503
                            ? "bg-white text-amber-900 border-amber-300 hover:bg-amber-100"
                            : "bg-white text-rose-900 border-rose-300 hover:bg-rose-100"
                        }`}
                        onClick={generate}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${insights.isPending ? "animate-spin" : ""}`} />
                        {insights.isPending ? "Retrying..." : "Try Again"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {!data && !insights.isPending && (
            <Card className="border-dashed border-slate-300 bg-white rounded-3xl shadow-none">
              <CardContent className="p-12 text-center">
                <Compass className="mx-auto h-12 w-12 text-indigo-400 mb-3 animate-pulse" />
                <h3 className="font-bold text-slate-900 text-lg">Ready to generate your AI career roadmap</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  Click "Generate AI Insights" above to analyze your profile, discover missing tech stacks, get tailored YouTube tutorials, and view a structured career roadmap.
                </p>
                <Button
                  onClick={generate}
                  disabled={insights.isPending || profileLoading}
                  className="mt-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> Generate now
                </Button>
              </CardContent>
            </Card>
          )}

          {data && (
            <>
              {/* Profile Suggestions */}
              <Card className="border-indigo-100 shadow-sm rounded-2xl bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <BrainCircuit className="h-5 w-5 text-indigo-600" /> AI Profile Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3.5">
                    {data.profileInsights.map((insight: string, index: number) => (
                      <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-700 bg-indigo-50/40 p-3.5 rounded-xl border border-indigo-100/60">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Job Match */}
              {data.jobMatch && <JobMatch match={data.jobMatch} />}

              {/* Career Roadmap */}
              {data.roadmap && data.roadmap.length > 0 && (
                <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                      <Compass className="h-5 w-5 text-violet-600" /> Comprehensive Career Roadmap
                    </CardTitle>
                    <CardDescription>Step-by-step milestones tailored to your career goals.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.roadmap.map((step: any, index: number) => (
                      <div key={index} className="flex gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-violet-50/30 transition-colors">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white font-bold text-sm shadow-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-slate-950 text-base">{step.phase}</h4>
                            <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs rounded-lg font-medium">{step.timeline}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Missing Stacks Analysis */}
              {data.missingStacks && data.missingStacks.length > 0 && (
                <Card className="border-rose-100 shadow-sm rounded-2xl bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-rose-950">
                      <Layers className="h-5 w-5 text-rose-600" /> Missing Stacks & Skill Gap Analysis
                    </CardTitle>
                    <CardDescription>Identified by inspecting your resume, GitHub repositories, LinkedIn, certificates, and skills.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {data.missingStacks.map((item: any, index: number) => (
                      <div key={index} className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-rose-950 text-sm">{item.stack}</h4>
                          <Badge className="bg-rose-100 text-rose-800 text-[10px]">Gap</Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-rose-800/80 leading-relaxed">{item.reason}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* YouTube Video Suggestions */}
              {data.youtubeSuggestions && data.youtubeSuggestions.length > 0 && (
                <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                      <Video className="h-5 w-5 text-red-600" /> Curated YouTube Tutorial Suggestions
                    </CardTitle>
                    <CardDescription>Recommended video masterclasses to level up your missing stacks.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    {data.youtubeSuggestions.map((video: any, index: number) => (
                      <a
                        key={index}
                        href={video.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group rounded-2xl border border-slate-200 p-5 hover:border-indigo-500 hover:shadow-md transition-all bg-white flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span className="font-medium text-indigo-600">{video.channel}</span>
                            <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                          <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-snug">{video.title}</h4>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                          Watch on YouTube
                        </div>
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Stack & Documentation Links */}
              {data.stackLinks && data.stackLinks.length > 0 && (
                <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                      <BookOpen className="h-5 w-5 text-emerald-600" /> Official Stack Documentation & Links
                    </CardTitle>
                    <CardDescription>Direct resource links for technologies you should explore.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {data.stackLinks.map((link: any, index: number) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all"
                      >
                        <span>{link.name}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Project Recommendations */}
              <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Lightbulb className="h-5 w-5 text-violet-600" /> Recommended Portfolio Projects
                  </CardTitle>
                  <CardDescription>Build these projects to showcase your readiness.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  {data.projectRecommendations.map((project: any, index: number) => (
                    <div key={index} className="rounded-2xl border border-slate-200 p-5 bg-slate-50/50 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-slate-950 text-base">{project.title}</h4>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{project.description}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-slate-200/60">
                        {project.skills.map((skill: string) => (
                          <Badge key={skill} variant="secondary" className="bg-white text-indigo-700 border border-indigo-100 text-xs rounded-lg">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Resume Improvement */}
              <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <FileText className="h-5 w-5 text-slate-700" /> Résumé Improvement Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-slate-600">{data.resumeInsight.message}</p>
                  {data.resumeInsight.suggestions.length > 0 && (
                    <ul className="mt-4 space-y-2.5">
                      {data.resumeInsight.suggestions.map((suggestion: string, index: number) => (
                        <li key={index} className="flex gap-2.5 text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="font-bold text-indigo-600">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <p className="flex gap-2 rounded-2xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600 border border-slate-200">
                <CircleAlert className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
                <span>{data.disclaimer} Generated on {new Date(data.generatedAt).toLocaleString()}.</span>
              </p>
            </>
          )}
        </section>

        <aside className="space-y-6">
          <Card className="border-violet-100 bg-gradient-to-br from-violet-50/60 to-indigo-50/40 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-950">Profile Attention & Gaps</CardTitle>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : missing.length ? (
                <>
                  <p className="text-sm leading-relaxed text-slate-700">Add these details to give AI recommendations even higher context:</p>
                  <ul className="mt-3 space-y-2">
                    {missing.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700 bg-white/80 p-2.5 rounded-xl border border-violet-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-slate-700 bg-white/80 p-3 rounded-xl border border-violet-100">
                  Your core student profile details are complete. Keep them updated as you build new projects and skills!
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 rounded-2xl shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-base font-bold">About AI Guidance</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-slate-600 space-y-2">
              <p>AI Career Insights analyzes your documented profile, projects, resume, and GitHub/LinkedIn links against modern industry standards and selected job postings.</p>
              <p>It is designed to empower your learning roadmap and interview readiness.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function JobMatch({ match }: { match: { matchScore: number; matchingSkills: string[]; missingSkills: string[]; reasoning: string; learningPriorities: string[]; interviewTopics: string[] } }) {
  return (
    <Card className="border-emerald-100 shadow-sm rounded-2xl bg-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-lg font-bold">
          <span className="flex items-center gap-2 text-slate-950">
            <Target className="h-5 w-5 text-emerald-600" /> Job Stack Match Analysis
          </span>
          <span className="text-2xl font-black text-emerald-700 bg-emerald-50 px-3.5 py-1 rounded-2xl border border-emerald-200">
            {match.matchScore}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${match.matchScore}%` }} />
        </div>
        <p className="text-sm leading-relaxed text-slate-600">{match.reasoning}</p>

        <div className="grid gap-6 md:grid-cols-2 pt-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
            <h4 className="text-sm font-semibold text-emerald-950 mb-2">Matching Skills</h4>
            <div className="flex flex-wrap gap-1.5">
              {match.matchingSkills.length ? (
                match.matchingSkills.map((skill) => (
                  <Badge key={skill} className="bg-emerald-100 text-emerald-800 text-xs rounded-lg font-medium">{skill}</Badge>
                ))
              ) : (
                <p className="text-xs text-slate-500">No direct overlap documented yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Missing Skills to Explore</h4>
            <div className="flex flex-wrap gap-1.5">
              {match.missingSkills.length ? (
                match.missingSkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="bg-white text-slate-700 border border-slate-200 text-xs rounded-lg font-medium">{skill}</Badge>
                ))
              ) : (
                <p className="text-xs text-slate-500">No missing required skills!</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Learning Priorities</h4>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {match.learningPriorities.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Interview Preparation</h4>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {match.interviewTopics.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
