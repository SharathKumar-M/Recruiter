import { useEffect, useState, useCallback } from "react";
import { useGetStudentProfile, useUpdateStudentProfile, getGetStudentProfileQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  User, Link as LinkIcon, Github, Briefcase, GraduationCap, X, Plus, Trash2, Edit3,
  CheckCircle2, AlertCircle, Award, FolderGit2, ShieldCheck, MapPin, ExternalLink
} from "lucide-react";

interface ProjectItem {
  id: number;
  studentId: number;
  title: string;
  description: string;
  technologies: string[];
  githubUrl?: string | null;
  liveUrl?: string | null;
}

interface ExperienceItem {
  id: number;
  studentId: number;
  organization: string;
  role: string;
  description: string;
  startDate: string;
  endDate?: string | null;
  current: boolean;
}

interface CertificateItem {
  id: number;
  filename: string;
  url: string;
  uploadedAt: string;
}

export default function StudentProfile() {
  const { data: profile, isLoading: isProfileLoading } = useGetStudentProfile();
  const queryClient = useQueryClient();

  // Personal Info & Education Form State
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [professionalSummary, setProfessionalSummary] = useState("");
  const [location, setLocation] = useState("");
  const [college, setCollege] = useState("");
  const [degree, setDegree] = useState("");
  const [branch, setBranch] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  // Links
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  // Categorized Skills
  const [programmingLanguages, setProgrammingLanguages] = useState<string[]>([]);
  const [plInput, setPlInput] = useState("");
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [fwInput, setFwInput] = useState("");
  const [databases, setDatabases] = useState<string[]>([]);
  const [dbInput, setDbInput] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [toolInput, setToolInput] = useState("");
  const [otherSkills, setOtherSkills] = useState<string[]>([]);
  const [otherInput, setOtherInput] = useState("");

  // Projects State
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectTechInput, setProjectTechInput] = useState("");
  const [projectTechs, setProjectTechs] = useState<string[]>([]);
  const [projectGithub, setProjectGithub] = useState("");
  const [projectLive, setProjectLive] = useState("");
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);

  // Experience State
  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [expOpen, setExpOpen] = useState(false);
  const [expOrg, setExpOrg] = useState("");
  const [expRole, setExpRole] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expStart, setExpStart] = useState("");
  const [expEnd, setExpEnd] = useState("");
  const [expCurrent, setExpCurrent] = useState(false);
  const [isSubmittingExp, setIsSubmittingExp] = useState(false);

  // Certificates State
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [certOpen, setCertOpen] = useState(false);
  const [certFilename, setCertFilename] = useState("");
  const [certUrl, setCertUrl] = useState("");
  const [isSubmittingCert, setIsSubmittingCert] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch Projects & Experience
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/student/projects");
      if (res.ok) setProjects(await res.json());
    } catch {}
  }, []);

  const fetchExperience = useCallback(async () => {
    try {
      const res = await fetch("/api/student/experience");
      if (res.ok) setExperience(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setPhotoUrl(profile.photoUrl || "");
      setProfessionalSummary((profile as any).professionalSummary || "");
      setLocation((profile as any).location || "");
      setCollege(profile.college || "");
      setDegree((profile as any).degree || "");
      setBranch((profile as any).branch || "");
      setGraduationYear((profile as any).graduationYear || "");
      setLinkedinUrl(profile.linkedinUrl || "");
      setGithubUrl(profile.githubUrl || "");
      setPortfolioUrl(profile.portfolioUrl || "");
      setProgrammingLanguages((profile as any).programmingLanguages || []);
      setFrameworks((profile as any).frameworks || []);
      setDatabases((profile as any).databases || []);
      setTools((profile as any).tools || []);
      setOtherSkills((profile as any).otherSkills || []);
      setCertificates(profile.certificates || []);
    }
    fetchProjects();
    fetchExperience();
  }, [profile, fetchProjects, fetchExperience]);

  const updateMutation = useUpdateStudentProfile({
    mutation: {
      onSuccess: () => {
        toast.success("Profile updated successfully");
        queryClient.invalidateQueries({ queryKey: getGetStudentProfileQueryKey() });
        setIsDirty(false);
        setIsSaving(false);
      },
      onError: () => {
        toast.error("Failed to update profile");
        setIsSaving(false);
      }
    }
  });

  const handleSaveAll = () => {
    if (!displayName.trim()) {
      toast.error("Full name is required");
      return;
    }
    setIsSaving(true);
    const allSkills = Array.from(new Set([...programmingLanguages, ...frameworks, ...databases, ...tools, ...otherSkills]));
    updateMutation.mutate({
      data: {
        displayName,
        college: college || null,
        linkedinUrl: linkedinUrl || null,
        githubUrl: githubUrl || null,
        portfolioUrl: portfolioUrl || null,
        skills: allSkills,
        //@ts-ignore
        location: location || null,
        graduationYear: graduationYear || null,
        professionalSummary: professionalSummary || null,
        degree: degree || null,
        branch: branch || null,
        photoUrl: photoUrl || null,
        programmingLanguages,
        frameworks,
        databases,
        tools,
        otherSkills,
      }
    });
  };

  const handleAddTag = (val: string, list: string[], setList: (arr: string[]) => void, setInput: (s: string) => void) => {
    if (val.trim() && !list.includes(val.trim())) {
      setList([...list, val.trim()]);
      setIsDirty(true);
    }
    setInput("");
  };

  const handleRemoveTag = (val: string, list: string[], setList: (arr: string[]) => void) => {
    setList(list.filter(item => item !== val));
    setIsDirty(true);
  };

  // Project Actions
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim() || !projectDesc.trim()) {
      toast.error("Project title and description are required");
      return;
    }
    setIsSubmittingProject(true);
    try {
      const res = await fetch("/api/student/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          description: projectDesc,
          technologies: projectTechs,
          githubUrl: projectGithub || null,
          liveUrl: projectLive || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      toast.success("Project added successfully");
      setProjectTitle("");
      setProjectDesc("");
      setProjectTechs([]);
      setProjectGithub("");
      setProjectLive("");
      setProjectOpen(false);
      fetchProjects();
    } catch {
      toast.error("Failed to add project");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleDeleteProject = async (id: number) => {
    try {
      const res = await fetch(`/api/student/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Project deleted");
      setProjects(projects.filter(p => p.id !== id));
    } catch {
      toast.error("Failed to delete project");
    }
  };

  // Experience Actions
  const handleCreateExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expOrg.trim() || !expRole.trim() || !expStart.trim()) {
      toast.error("Organization, role, and start date are required");
      return;
    }
    setIsSubmittingExp(true);
    try {
      const res = await fetch("/api/student/experience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: expOrg,
          role: expRole,
          description: expDesc,
          startDate: expStart,
          endDate: expCurrent ? null : expEnd,
          current: expCurrent,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Experience added");
      setExpOrg("");
      setExpRole("");
      setExpDesc("");
      setExpStart("");
      setExpEnd("");
      setExpCurrent(false);
      setExpOpen(false);
      fetchExperience();
    } catch {
      toast.error("Failed to add experience");
    } finally {
      setIsSubmittingExp(false);
    }
  };

  const handleDeleteExperience = async (id: number) => {
    try {
      const res = await fetch(`/api/student/experience/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Experience deleted");
      setExperience(experience.filter(e => e.id !== id));
    } catch {
      toast.error("Failed to delete experience");
    }
  };

  // Certificate Actions
  const handleCreateCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFilename.trim() || !certUrl.trim()) {
      toast.error("Certificate title/filename and URL are required");
      return;
    }
    setIsSubmittingCert(true);
    try {
      const res = await fetch("/api/student/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: "certificate",
          filename: certFilename,
          url: certUrl,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Certificate uploaded");
      setCertFilename("");
      setCertUrl("");
      setCertOpen(false);
      // refetch profile to update certificates
      window.location.reload();
    } catch {
      toast.error("Failed to add certificate");
    } finally {
      setIsSubmittingCert(false);
    }
  };

  // Profile completion calculation
  let completion = 0;
  if (displayName) completion += 15;
  if (photoUrl) completion += 10;
  if (professionalSummary && professionalSummary.length >= 10) completion += 10;
  if (location) completion += 5;
  if (college && degree) completion += 20;
  if (programmingLanguages.length > 0 || frameworks.length > 0 || databases.length > 0) completion += 20;
  if (githubUrl || linkedinUrl) completion += 10;
  if (certificates.length > 0 || profile?.resumeUrl) completion += 10;
  completion = Math.min(100, completion);

  if (isProfileLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8 space-y-8 pb-24">
      {/* Top Banner / Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 md:p-10 text-white shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center text-2xl font-bold overflow-hidden border-2 border-white/20 shadow-inner">
              {photoUrl ? (
                <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{displayName ? displayName.charAt(0).toUpperCase() : "S"}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{displayName || "Student Profile"}</h1>
                <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 text-xs">Student Talent</Badge>
              </div>
              <p className="text-indigo-200 text-sm mt-1">
                {degree && branch ? `${degree} in ${branch}` : "Engineering Student"} {college ? `• ${college}` : ""}
              </p>
              {location && (
                <p className="text-xs text-indigo-300 mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {location}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-medium text-indigo-200 mb-2">
              <span>Profile Completion</span>
              <span className="font-bold text-white">{completion}%</span>
            </div>
            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all duration-500 rounded-full" style={{ width: `${completion}%` }} />
            </div>
            <p className="text-[11px] text-indigo-300 mt-2">Complete all sections to unlock top recruiter matches.</p>
          </div>
        </div>
      </section>

      {/* Main Grid Content */}
      <div className="grid gap-8 lg:grid-cols-3">

        {/* Left 2 Cols: Personal, Education, Categorized Skills, Links */}
        <div className="lg:col-span-2 space-y-8">

          {/* Personal Information */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" /> Personal Information
              </CardTitle>
              <CardDescription>Update your personal bio, avatar, and professional summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Full Name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="e.g. Alex Johnson"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Location (City, Country)</Label>
                  <Input
                    value={location}
                    onChange={(e) => { setLocation(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Profile Image URL</Label>
                  <Input
                    value={photoUrl}
                    onChange={(e) => { setPhotoUrl(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Graduation Year</Label>
                  <Input
                    value={graduationYear}
                    onChange={(e) => { setGraduationYear(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="e.g. 2027"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Professional Summary</Label>
                <Textarea
                  value={professionalSummary}
                  onChange={(e) => { setProfessionalSummary(e.target.value); setIsDirty(true); }}
                  className="mt-1.5 rounded-xl bg-white min-h-[100px]"
                  placeholder="Write a short summary about your background, passion, and career aspirations..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" /> Education Background
              </CardTitle>
              <CardDescription>Specify your college, degree, and branch of study.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700">College / University</Label>
                  <Input
                    value={college}
                    onChange={(e) => { setCollege(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="e.g. Stanford University"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Degree</Label>
                  <Input
                    value={degree}
                    onChange={(e) => { setDegree(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="e.g. B.Tech / B.S."
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Branch / Major</Label>
                  <Input
                    value={branch}
                    onChange={(e) => { setBranch(e.target.value); setIsDirty(true); }}
                    className="mt-1.5 rounded-xl bg-white"
                    placeholder="e.g. Computer Science"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categorized Skills */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-600" /> Categorized Skills
              </CardTitle>
              <CardDescription>Organize your technical competencies by category.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Programming Languages */}
              <div>
                <Label className="text-xs font-medium text-slate-700">Programming Languages</Label>
                <div className="flex flex-wrap gap-2 my-2">
                  {programmingLanguages.map(lang => (
                    <Badge key={lang} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 px-3 py-1 text-xs rounded-xl">
                      {lang}
                      <button onClick={() => handleRemoveTag(lang, programmingLanguages, setProgrammingLanguages)} className="hover:text-rose-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={plInput}
                  onChange={(e) => setPlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(plInput, programmingLanguages, setProgrammingLanguages, setPlInput); } }}
                  placeholder="Type language (e.g. TypeScript, Python) and press Enter..."
                  className="rounded-xl bg-white"
                />
              </div>

              {/* Frameworks */}
              <div>
                <Label className="text-xs font-medium text-slate-700">Frameworks & Libraries</Label>
                <div className="flex flex-wrap gap-2 my-2">
                  {frameworks.map(fw => (
                    <Badge key={fw} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 px-3 py-1 text-xs rounded-xl">
                      {fw}
                      <button onClick={() => handleRemoveTag(fw, frameworks, setFrameworks)} className="hover:text-rose-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={fwInput}
                  onChange={(e) => setFwInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(fwInput, frameworks, setFrameworks, setFwInput); } }}
                  placeholder="Type framework (e.g. React, Next.js, Express) and press Enter..."
                  className="rounded-xl bg-white"
                />
              </div>

              {/* Databases */}
              <div>
                <Label className="text-xs font-medium text-slate-700">Databases</Label>
                <div className="flex flex-wrap gap-2 my-2">
                  {databases.map(db => (
                    <Badge key={db} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 px-3 py-1 text-xs rounded-xl">
                      {db}
                      <button onClick={() => handleRemoveTag(db, databases, setDatabases)} className="hover:text-rose-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={dbInput}
                  onChange={(e) => setDbInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(dbInput, databases, setDatabases, setDbInput); } }}
                  placeholder="Type database (e.g. PostgreSQL, MongoDB) and press Enter..."
                  className="rounded-xl bg-white"
                />
              </div>

              {/* Tools */}
              <div>
                <Label className="text-xs font-medium text-slate-700">Tools & Platforms</Label>
                <div className="flex flex-wrap gap-2 my-2">
                  {tools.map(tool => (
                    <Badge key={tool} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 px-3 py-1 text-xs rounded-xl">
                      {tool}
                      <button onClick={() => handleRemoveTag(tool, tools, setTools)} className="hover:text-rose-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(toolInput, tools, setTools, setToolInput); } }}
                  placeholder="Type tool (e.g. Git, Docker, AWS) and press Enter..."
                  className="rounded-xl bg-white"
                />
              </div>

            </CardContent>
          </Card>

          {/* Professional Links */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-indigo-600" /> Professional Links
              </CardTitle>
              <CardDescription>Connect your code repositories and professional portfolio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-700">GitHub Profile URL</Label>
                <Input
                  value={githubUrl}
                  onChange={(e) => { setGithubUrl(e.target.value); setIsDirty(true); }}
                  placeholder="https://github.com/username"
                  className="mt-1.5 rounded-xl bg-white"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">LinkedIn Profile URL</Label>
                <Input
                  value={linkedinUrl}
                  onChange={(e) => { setLinkedinUrl(e.target.value); setIsDirty(true); }}
                  placeholder="https://linkedin.com/in/username"
                  className="mt-1.5 rounded-xl bg-white"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Portfolio Website URL</Label>
                <Input
                  value={portfolioUrl}
                  onChange={(e) => { setPortfolioUrl(e.target.value); setIsDirty(true); }}
                  placeholder="https://yourportfolio.dev"
                  className="mt-1.5 rounded-xl bg-white"
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Col: Projects, Experience, Certificates */}
        <div className="space-y-8">

          {/* Projects Section */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FolderGit2 className="h-5 w-5 text-indigo-600" /> Projects
                </CardTitle>
                <CardDescription>Showcase your standout work.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setProjectOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length > 0 ? (
                projects.map((proj) => (
                  <div key={proj.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2 relative group">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-slate-950 text-sm">{proj.title}</h4>
                      <button onClick={() => handleDeleteProject(proj.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{proj.description}</p>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.technologies.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-2 text-xs">
                      {proj.githubUrl && (
                        <a href={proj.githubUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 font-medium">
                          GitHub <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {proj.liveUrl && (
                        <a href={proj.liveUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 font-medium">
                          Live Demo <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs">No projects added yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Experience Section */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-indigo-600" /> Experience
                </CardTitle>
                <CardDescription>Internships & employment.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setExpOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {experience.length > 0 ? (
                experience.map((exp) => (
                  <div key={exp.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1 relative">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-950 text-sm">{exp.role}</h4>
                        <p className="text-xs font-medium text-indigo-600">{exp.organization}</p>
                      </div>
                      <button onClick={() => handleDeleteExperience(exp.id)} className="text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 pt-0.5">
                      {exp.startDate} — {exp.current ? "Present" : exp.endDate || "Present"}
                    </p>
                    <p className="text-xs text-slate-600 pt-1">{exp.description}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs">No experience added yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificates Section */}
          <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-600" /> Certificates
                </CardTitle>
                <CardDescription>Verified credentials.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setCertOpen(true)} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {certificates.length > 0 ? (
                certificates.map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                        <Award className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-slate-950">{cert.filename}</h5>
                        <p className="text-[11px] text-slate-400">Added {new Date(cert.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <a href={cert.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs">No certificates added yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Floating Sticky Save Bar */}
      {isDirty && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
        >
          <div className="bg-slate-900 text-white shadow-2xl rounded-2xl px-6 py-3.5 flex items-center gap-6 border border-slate-800 max-w-md w-full justify-between">
            <span className="text-sm font-medium">You have unsaved profile changes.</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl">
                Discard
              </Button>
              <Button size="sm" onClick={handleSaveAll} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Add Project Dialog */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Project</DialogTitle>
            <DialogDescription>Highlight a project you have built.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium">Project Title</Label>
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. AI SaaS Platform"
                className="mt-1.5 rounded-xl"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="What did you build and what technologies were used?"
                className="mt-1.5 rounded-xl"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Technologies (Press Enter to add)</Label>
              <div className="flex flex-wrap gap-1.5 my-2">
                {projectTechs.map(tech => (
                  <Badge key={tech} variant="secondary" className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-lg flex items-center gap-1">
                    {tech}
                    <button type="button" onClick={() => setProjectTechs(projectTechs.filter(t => t !== tech))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                value={projectTechInput}
                onChange={(e) => setProjectTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && projectTechInput.trim()) {
                    e.preventDefault();
                    if (!projectTechs.includes(projectTechInput.trim())) {
                      setProjectTechs([...projectTechs, projectTechInput.trim()]);
                    }
                    setProjectTechInput("");
                  }
                }}
                placeholder="e.g. React, Tailwind"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">GitHub URL</Label>
                <Input
                  value={projectGithub}
                  onChange={(e) => setProjectGithub(e.target.value)}
                  placeholder="https://github.com/..."
                  className="mt-1.5 rounded-xl text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Live URL</Label>
                <Input
                  value={projectLive}
                  onChange={(e) => setProjectLive(e.target.value)}
                  placeholder="https://..."
                  className="mt-1.5 rounded-xl text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setProjectOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmittingProject} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmittingProject ? "Adding..." : "Add Project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Experience Dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Experience</DialogTitle>
            <DialogDescription>Add an internship or work experience.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateExperience} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Organization / Company</Label>
                <Input
                  value={expOrg}
                  onChange={(e) => setExpOrg(e.target.value)}
                  placeholder="e.g. Google"
                  className="mt-1.5 rounded-xl"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Role / Title</Label>
                <Input
                  value={expRole}
                  onChange={(e) => setExpRole(e.target.value)}
                  placeholder="e.g. Software Engineer Intern"
                  className="mt-1.5 rounded-xl"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Start Date</Label>
                <Input
                  value={expStart}
                  onChange={(e) => setExpStart(e.target.value)}
                  placeholder="e.g. Jun 2025"
                  className="mt-1.5 rounded-xl"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-medium">End Date</Label>
                <Input
                  value={expEnd}
                  onChange={(e) => setExpEnd(e.target.value)}
                  placeholder="e.g. Aug 2025"
                  disabled={expCurrent}
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="currentExp"
                checked={expCurrent}
                onChange={(e) => setExpCurrent(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="currentExp" className="text-xs text-slate-700 font-medium">I currently work here</label>
            </div>
            <div>
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="What were your key responsibilities and achievements?"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setExpOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmittingExp} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmittingExp ? "Adding..." : "Add Experience"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Certificate Dialog */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Certificate</DialogTitle>
            <DialogDescription>Add a verified credential link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCertificate} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-medium">Certificate Title / Filename</Label>
              <Input
                value={certFilename}
                onChange={(e) => setCertFilename(e.target.value)}
                placeholder="e.g. AWS Certified Solutions Architect"
                className="mt-1.5 rounded-xl"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Credential URL</Label>
              <Input
                value={certUrl}
                onChange={(e) => setCertUrl(e.target.value)}
                placeholder="https://credly.com/..."
                className="mt-1.5 rounded-xl"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setCertOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmittingCert} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmittingCert ? "Adding..." : "Add Certificate"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
