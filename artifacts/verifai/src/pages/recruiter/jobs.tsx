import { useState } from "react";
import { useGetRecruiterJobs, useCreateJob, getGetRecruiterJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, MapPin, Plus, Users, Clock, Building, X } from "lucide-react";
import { motion } from "framer-motion";

const jobSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  company: z.string().min(2, "Company must be at least 2 characters"),
  location: z.string().min(2, "Location is required"),
  jobType: z.enum(["Remote", "Hybrid", "On-site"]),
  salary: z.string().optional(),
  description: z.string().min(50, "Description must be at least 50 characters"),
});

type JobValues = z.infer<typeof jobSchema>;

export default function RecruiterJobs() {
  const { data: jobs, isLoading } = useGetRecruiterJobs();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  const form = useForm<JobValues>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: "",
      company: "",
      location: "",
      jobType: "Remote",
      salary: "",
      description: "",
    },
  });

  const createMutation = useCreateJob({
    mutation: {
      onSuccess: () => {
        toast.success("Job posted successfully!");
        queryClient.invalidateQueries({ queryKey: getGetRecruiterJobsQueryKey() });
        setOpen(false);
        form.reset();
        setSkills([]);
      },
      onError: () => {
        toast.error("Failed to post job");
      }
    }
  });

  const onSubmit = (data: JobValues) => {
    if (skills.length === 0) {
      toast.error("Please add at least one skill");
      return;
    }
    
    createMutation.mutate({
      data: {
        ...data,
        skills,
      }
    });
  };

  const addSkill = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  return (
    <main className="flex-1 container mx-auto p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Job Postings</h1>
          <p className="text-slate-600 mt-1">Manage your active jobs and applicants</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Post New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Post a New Job</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Frontend Developer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Corp" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="San Francisco, CA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Remote">Remote</SelectItem>
                            <SelectItem value="Hybrid">Hybrid</SelectItem>
                            <SelectItem value="On-site">On-site</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary Range (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="$100k - $120k" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Required Skills
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {skills.map(skill => (
                      <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input 
                    placeholder="Type a skill and press Enter..." 
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={addSkill}
                    onBlur={(e) => {
                      e.preventDefault();
                    }}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the role, responsibilities, and requirements..." 
                          className="min-h-[150px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                    {createMutation.isPending ? "Posting..." : "Post Job"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs?.length === 0 ? (
        <Card className="p-16 text-center border-dashed bg-slate-50/50">
          <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-2xl font-semibold text-slate-900 mb-2">No jobs posted yet</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Create your first job posting to start attracting verified talent to your company.
          </p>
          <Button onClick={() => setOpen(true)}>Post Your First Job</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs?.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full flex flex-col hover:shadow-md transition-shadow hover:border-indigo-200">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={job.isActive ? "default" : "secondary"} className={job.isActive ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}>
                      {job.isActive ? "Active" : "Closed"}
                    </Badge>
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" /> {new Date(job.postedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-xl leading-tight line-clamp-2 min-h-[3rem]">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mt-2">
                    <Building className="w-4 h-4 text-slate-400" /> {job.company}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <div className="flex flex-col gap-2 text-sm text-slate-600 mb-4">
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400 shrink-0" /> {job.location} ({job.jobType})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.skills.slice(0, 3).map(skill => (
                      <Badge key={skill} variant="secondary" className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600">{skill}</Badge>
                    ))}
                    {job.skills.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600">+{job.skills.length - 3}</Badge>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t bg-slate-50/50 flex justify-between items-center rounded-b-xl">
                  <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                    <Users className="w-4 h-4" />
                    <span>{job.applicantCount} Applicants</span>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    <a href={`/recruiter?job=${job.id}`}>View</a>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
