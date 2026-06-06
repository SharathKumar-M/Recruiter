import { useListJobs, useGetJobFilters, useApplyToJob, useGetStudentStats, useGetMyApplications, getListJobsQueryKey, getGetStudentStatsQueryKey, getGetMyApplicationsQueryKey } from "@workspace/api-client-react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Building, Briefcase, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function StudentHome() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: filters } = useGetJobFilters();
  const { data: stats } = useGetStudentStats();
  const { data: applications } = useGetMyApplications();
  
  const appliedJobIds = useMemo(() => {
    return new Set(applications?.map(app => app.jobId) || []);
  }, [applications]);

  const { data: jobs, isLoading: isJobsLoading } = useListJobs({
    search: searchTerm || undefined,
    skills: selectedSkills.length > 0 ? selectedSkills.join(",") : undefined,
    jobType: selectedJobTypes.length > 0 ? selectedJobTypes.join(",") : undefined,
  });

  const applyMutation = useApplyToJob({
    mutation: {
      onSuccess: () => {
        toast.success("Application submitted successfully!");
        queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStudentStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyApplicationsQueryKey() });
      },
      onError: (err) => {
        toast.error("Failed to apply. Please try again.");
        console.error(err);
      }
    }
  });

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const toggleJobType = (type: string) => {
    setSelectedJobTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-3xl font-bold text-indigo-700">{stats?.totalApplications || 0}</span>
            <span className="text-sm font-medium text-indigo-600 mt-1">Total Applications</span>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-3xl font-bold text-amber-700">{stats?.pendingApplications || 0}</span>
            <span className="text-sm font-medium text-amber-600 mt-1">Pending</span>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-3xl font-bold text-emerald-700">{stats?.shortlistedApplications || 0}</span>
            <span className="text-sm font-medium text-emerald-600 mt-1">Shortlisted</span>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 flex flex-col justify-center items-center text-center">
            <span className="text-3xl font-bold text-slate-700">{stats?.profileCompletion || 0}%</span>
            <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full" 
                style={{ width: `${stats?.profileCompletion || 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 mt-1">Profile Completion</span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Job title or company..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filters && filters.jobTypes.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Job Type</h3>
              <div className="flex flex-wrap gap-2">
                {filters.jobTypes.map(type => (
                  <Badge 
                    key={type} 
                    variant={selectedJobTypes.includes(type) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleJobType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {filters && filters.skills.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {filters.skills.map(skill => (
                  <Badge 
                    key={skill} 
                    variant={selectedSkills.includes(skill) ? "secondary" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Job Listings */}
        <div className="flex-1 space-y-4">
          <h2 className="text-2xl font-bold mb-4">Available Positions</h2>
          
          {isJobsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="mb-4">
                <CardHeader>
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : jobs?.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No jobs found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search term.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobs?.map((job, index) => {
                const hasApplied = appliedJobIds.has(job.id);
                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="transition-all hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl">{job.title}</CardTitle>
                            <CardDescription className="text-base flex items-center gap-2 mt-1 font-medium text-slate-700">
                              <Building className="w-4 h-4" /> {job.company}
                            </CardDescription>
                          </div>
                          {hasApplied ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Applied
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {new Date(job.postedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="flex flex-wrap gap-4 mb-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {job.location}</span>
                          <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-slate-400" /> {job.jobType}</span>
                          {job.salary && <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-slate-400" /> {job.salary}</span>}
                        </div>
                        <p className="text-slate-600 line-clamp-2 mb-4">{job.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {job.skills.map(skill => (
                            <Badge key={skill} variant="secondary" className="bg-slate-100 text-slate-700">{skill}</Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0 justify-end">
                        <Button 
                          disabled={hasApplied || applyMutation.isPending}
                          onClick={() => applyMutation.mutate({ jobId: job.id })}
                          className={hasApplied ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                        >
                          {hasApplied ? "Application Submitted" : "Apply Now"}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}