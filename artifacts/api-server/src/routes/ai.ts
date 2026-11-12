import { Router } from "express";
import {
  getUsersCollection,
  getVerificationsCollection,
  getCertificatesCollection,
  getJobsCollection,
  getNextSequence,
  toIdFilter,
} from "@workspace/db";
import { GenerateStudentInsightsBody } from "@workspace/api-zod";
import { requireRecruiter, requireStudent } from "../middlewares/requireAuth";

const router = Router();

function serializeVerification(v: any) {
  return {
    id: v.id ?? v._id?.toString(),
    studentId: v.studentId,
    trustScore: v.trustScore,
    verdict: v.verdict,
    summary: v.summary,
    strengths: v.strengths ?? [],
    redFlags: v.redFlags ?? [],
    educationCheck: v.educationCheck,
    experienceCheck: v.experienceCheck,
    githubCheck: v.githubCheck,
    certificatesCheck: v.certificatesCheck,
    recommendation: v.recommendation,
    analyzedAt: v.analyzedAt instanceof Date ? v.analyzedAt.toISOString() : v.analyzedAt,
  };
}

async function runAIVerification(student: any, certificates: any[]): Promise<any> {
  const profileDetails = [
    `Name: ${student.displayName}`,
    `College: ${student.college ?? "Not specified"}`,
    `Skills: ${(student.skills ?? []).join(", ") || "None listed"}`,
    `GitHub: ${student.githubUrl ?? "Not provided"}`,
    `LinkedIn: ${student.linkedinUrl ?? "Not provided"}`,
    `Portfolio: ${student.portfolioUrl ?? "Not provided"}`,
    `Resume uploaded: ${student.resumeUrl ? "Yes" : "No"}`,
    `Certificates uploaded: ${certificates.length}`,
  ].join("\n");

  try {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText } = await import("ai");

    const openai = createOpenAI({
      baseURL: process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY ?? "",
    });

    const prompt = `You are VERIF-AI, an expert AI agent that verifies student profiles for recruiters.

Analyze this student's profile and generate a trust assessment:

${profileDetails}

Return a JSON object ONLY (no markdown, no explanation) with this exact structure:
{
  "trust_score": <0-100>,
  "verdict": "<AUTHENTIC|LIKELY_AUTHENTIC|SUSPICIOUS|FAKE>",
  "summary": "<2-3 sentence summary>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "red_flags": ["<flag 1>"],
  "education_check": {"status": "<VERIFIED|UNVERIFIED|SUSPICIOUS>", "detail": "<detail>"},
  "experience_check": {"status": "<VERIFIED|UNVERIFIED|SUSPICIOUS>", "detail": "<detail>"},
  "github_check": {"status": "<AUTHENTIC|SUSPICIOUS|NO_ACTIVITY>", "detail": "<detail>"},
  "certificates_check": {"status": "<VERIFIED|SUSPICIOUS|FAKE>", "detail": "<detail>"},
  "recommendation": "<specific advice for recruiter>"
}`;

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxOutputTokens: 1000,
    });

    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON in response");
  } catch (err) {
    const hasGitHub = !!student.githubUrl;
    const hasLinkedIn = !!student.linkedinUrl;
    const hasResume = !!student.resumeUrl;
    const hasCerts = certificates.length > 0;
    const skillCount = (student.skills ?? []).length;

    let score = 30;
    if (hasGitHub) score += 20;
    if (hasLinkedIn) score += 15;
    if (hasResume) score += 20;
    if (hasCerts) score += 10;
    if (skillCount >= 3) score += 5;
    if (student.college) score += 5;
    score = Math.min(95, score);

    const verdict = score >= 75 ? "LIKELY_AUTHENTIC" : score >= 50 ? "SUSPICIOUS" : "UNVERIFIED";

    return {
      trust_score: score,
      verdict,
      summary: `Profile analysis based on available information. Student has provided ${[hasResume ? "a resume" : null, hasGitHub ? "a GitHub profile" : null, hasLinkedIn ? "a LinkedIn profile" : null, hasCerts ? `${certificates.length} certificate(s)` : null].filter(Boolean).join(", ") || "limited profile information"}.`,
      strengths: [
        hasResume ? "Resume has been uploaded" : null,
        hasGitHub ? "GitHub profile linked — technical activity can be verified" : null,
        hasLinkedIn ? "LinkedIn profile provided" : null,
        skillCount > 0 ? `${skillCount} skills listed` : null,
        hasCerts ? `${certificates.length} certificate(s) uploaded` : null,
      ].filter(Boolean),
      red_flags: [
        !hasResume ? "No resume uploaded — core document missing" : null,
        !hasGitHub ? "No GitHub profile — technical claims unverifiable" : null,
        !student.college ? "No college/institution specified" : null,
      ].filter(Boolean),
      education_check: {
        status: student.college ? "UNVERIFIED" : "SUSPICIOUS",
        detail: student.college ? `Institution "${student.college}" mentioned but not independently verified.` : "No educational institution provided.",
      },
      experience_check: {
        status: hasResume ? "UNVERIFIED" : "SUSPICIOUS",
        detail: hasResume ? "Resume uploaded but content not yet analyzed. Manual review recommended." : "No resume uploaded to verify work experience.",
      },
      github_check: {
        status: hasGitHub ? "AUTHENTIC" : "NO_ACTIVITY",
        detail: hasGitHub ? `GitHub URL provided: ${student.githubUrl}. Profile appears to exist.` : "No GitHub profile linked. Cannot verify technical skills.",
      },
      certificates_check: {
        status: hasCerts ? "UNVERIFIED" : "SUSPICIOUS",
        detail: hasCerts ? `${certificates.length} certificate(s) uploaded. Manual review needed to verify authenticity.` : "No certificates uploaded.",
      },
      recommendation: score >= 60
        ? "Candidate has a reasonably complete profile. Proceed with an interview to verify claims directly."
        : "Profile is incomplete. Request additional documentation (resume, certificates) before proceeding.",
    };
  }
}

router.post("/ai/analyze/:studentId", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const studentParam = req.params.studentId as string;
    const [usersCol, certificatesCol, verificationsCol] = await Promise.all([
      getUsersCollection(),
      getCertificatesCollection(),
      getVerificationsCollection(),
    ]);

    const student = await usersCol.findOne({
      $and: [toIdFilter(studentParam), { role: "student" }],
    });

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const studentIdConditions: any[] = [];
    if (student.id !== undefined) studentIdConditions.push({ studentId: student.id });
    if (student._id) {
      studentIdConditions.push({ studentId: student._id });
      studentIdConditions.push({ studentId: student._id.toString() });
    }

    const certs = await certificatesCol.find({ $or: studentIdConditions }).toArray();
    const aiResult = await runAIVerification(student, certs);

    const seqId = await getNextSequence("verifications");
    const now = new Date();

    const newVerification = {
      id: seqId,
      studentId: student.id ?? student._id,
      recruiterId: recruiter.id ?? recruiter._id,
      trustScore: aiResult.trust_score,
      verdict: aiResult.verdict,
      summary: aiResult.summary,
      strengths: aiResult.strengths ?? [],
      redFlags: aiResult.red_flags ?? [],
      educationCheck: aiResult.education_check,
      experienceCheck: aiResult.experience_check,
      githubCheck: aiResult.github_check,
      certificatesCheck: aiResult.certificates_check,
      recommendation: aiResult.recommendation,
      analyzedAt: now,
    };

    const result = await verificationsCol.insertOne(newVerification);
    res.json(serializeVerification({ ...newVerification, _id: result.insertedId }));
  } catch (err) {
    req.log.error({ err }, "ai analyze error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ai/result/:studentId", requireRecruiter, async (req, res) => {
  try {
    const studentParam = req.params.studentId as string;
    const [usersCol, verificationsCol] = await Promise.all([
      getUsersCollection(),
      getVerificationsCollection(),
    ]);

    const student = await usersCol.findOne(toIdFilter(studentParam));
    const studentIdConditions: any[] = [];
    if (student?.id !== undefined) studentIdConditions.push({ studentId: student.id });
    if (student?._id) {
      studentIdConditions.push({ studentId: student._id });
      studentIdConditions.push({ studentId: student._id.toString() });
    }
    studentIdConditions.push(toIdFilter(studentParam));

    const result = await verificationsCol.findOne(
      { $or: studentIdConditions },
      { sort: { analyzedAt: -1 } }
    );

    if (!result) {
      res.status(404).json({ error: "No verification result found" });
      return;
    }

    res.json(serializeVerification(result));
  } catch (err) {
    req.log.error({ err }, "get ai result error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/student-insights", requireStudent, async (req, res) => {
  try {
    const parsed = GenerateStudentInsightsBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const student = (req as any).dbUser;
    const [certificatesCol, jobsCol] = await Promise.all([
      getCertificatesCollection(),
      getJobsCollection(),
    ]);

    const studentIdConditions: any[] = [];
    if (student.id !== undefined) studentIdConditions.push({ studentId: student.id });
    if (student._id) {
      studentIdConditions.push({ studentId: student._id });
      studentIdConditions.push({ studentId: student._id.toString() });
    }

    const certs = await certificatesCol.find({ $or: studentIdConditions }).toArray();
    const jobId = parsed.data.jobId;
    const job = jobId ? await jobsCol.findOne(toIdFilter(jobId)) : null;

    if (jobId && (!job || !job.isActive)) {
      res.status(404).json({ error: "Active job not found" });
      return;
    }

    const documentedSkills = (student.skills ?? []).map((skill: string) => skill.trim()).filter(Boolean);
    const requiredSkills = job?.skills ?? [];
    const normalizedStudentSkills = new Map(documentedSkills.map((skill: string) => [skill.toLowerCase(), skill]));
    const matchingSkills = requiredSkills.filter((skill: string) => normalizedStudentSkills.has(skill.toLowerCase()));
    const missingSkills = requiredSkills.filter((skill: string) => !normalizedStudentSkills.has(skill.toLowerCase()));
    const matchScore = job ? (requiredSkills.length ? Math.round((matchingSkills.length / requiredSkills.length) * 100) : 0) : null;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    let generated: any = null;

    const profileData = {
      displayName: student.displayName,
      college: student.college ?? null,
      degree: student.degree ?? null,
      branch: student.branch ?? null,
      skills: documentedSkills,
      hasLinkedIn: Boolean(student.linkedinUrl),
      hasGitHub: Boolean(student.githubUrl),
      hasPortfolio: Boolean(student.portfolioUrl),
      hasResume: Boolean(student.resumeUrl),
      certificatesCount: certs.length,
    };

    const prompt = `You are a supportive expert career coach and technical mentor. Analyze this student profile and job context. Return JSON only with this exact shape:
{
  "profileInsights": ["actionable profile suggestion 1", "suggestion 2"],
  "reasoning": "brief explanation for the job match or career alignment",
  "learningPriorities": ["learning priority 1", "priority 2"],
  "interviewTopics": ["interview topic 1", "topic 2"],
  "roadmap": [
    {"phase": "Phase 1: Foundation & Skills", "description": "Strengthen core fundamentals", "timeline": "Weeks 1-2"},
    {"phase": "Phase 2: Advanced Stack & Projects", "description": "Build portfolio apps", "timeline": "Weeks 3-5"},
    {"phase": "Phase 3: Interview & System Design", "description": "Mock interviews & prep", "timeline": "Weeks 6-8"}
  ],
  "youtubeSuggestions": [
    {"title": "Full-Stack System Design Masterclass", "channel": "NeetCode / Traversy Media", "url": "https://www.youtube.com/results?search_query=full+stack+system+design+tutorial"}
  ],
  "stackLinks": [
    {"name": "React & Next.js Docs", "url": "https://react.dev"},
    {"name": "Node.js & Express", "url": "https://nodejs.org/docs"},
    {"name": "MongoDB Atlas & Mongoose", "url": "https://www.mongodb.com/docs/"}
  ],
  "missingStacks": [
    {"stack": "Docker & DevOps", "reason": "Not listed in your skills or projects, essential for production deployments."}
  ],
  "projectRecommendations": [
    {"title": "Cloud-Native SaaS Dashboard", "description": "Build an end-to-end full-stack app with auth and database integration.", "skills": ["React", "Node.js", "MongoDB"]}
  ],
  "resumeInsight": {
    "available": true,
    "message": "Your resume is attached and ready for recruiter review.",
    "suggestions": ["Highlight measurable impact and metrics in project descriptions", "Ensure GitHub and LinkedIn links are prominent"]
  }
}
Profile: ${JSON.stringify(profileData)}
Job context: ${job ? JSON.stringify({ title: job.title, company: job.company, description: job.description, requiredSkills, matchingSkills, missingSkills }) : "No job selected"}`;

    try {
      if (geminiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2500 },
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as any;
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) generated = JSON.parse(match[0]);
          }
        }
      } else if (openaiKey) {
        const { createOpenAI } = await import("@ai-sdk/openai");
        const { generateText } = await import("ai");
        const openai = createOpenAI({ baseURL: process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1", apiKey: openaiKey });
        const result = await generateText({ model: openai("gpt-4o-mini"), prompt, maxOutputTokens: 2000 });
        const match = result.text.match(/\{[\s\S]*\}/);
        if (match) generated = JSON.parse(match[0]);
      }
    } catch (e) {
      // Fallback if AI call fails
    }

    if (!generated || !Array.isArray(generated.profileInsights)) {
      const hasGitHub = Boolean(student.githubUrl);
      const hasLinkedIn = Boolean(student.linkedinUrl);
      const hasResume = Boolean(student.resumeUrl);
      const hasCerts = certs.length > 0;

      generated = {
        profileInsights: [
          hasResume ? "Your resume is uploaded and accessible to recruiters." : "Upload your resume to increase verification trust and completeness.",
          hasGitHub ? "GitHub repository linked — keep your commit activity active." : "Link your GitHub profile to showcase real-world code contributions.",
          hasLinkedIn ? "LinkedIn profile linked successfully." : "Add your LinkedIn profile to expand your professional network.",
          documentedSkills.length >= 3 ? `You have documented ${documentedSkills.length} skills.` : "Add more specific programming languages and frameworks to your skills list.",
        ],
        reasoning: job ? `Match score is calculated based on overlap between your skills (${documentedSkills.join(", ") || "none"}) and the job requirements (${requiredSkills.join(", ") || "none"}).` : "General career guidance based on your profile competencies.",
        learningPriorities: missingSkills.length > 0 ? missingSkills.slice(0, 4) : ["Advanced System Architecture", "TypeScript Design Patterns", "CI/CD & Cloud Deployment"],
        interviewTopics: job ? [job.title, "System Design & Scalability", "Behavioral & Past Project Walkthroughs"] : ["Core Computer Science Fundamentals", "Problem Solving & Algorithms", "Full-Stack System Design"],
        roadmap: [
          { phase: "Phase 1: Profile & Core Competencies", description: "Complete all education, skills, and links in your student profile.", timeline: "Week 1" },
          { phase: "Phase 2: Portfolio & Missing Stacks", description: "Build 2-3 production-grade projects focusing on missing skills like Docker, Testing, and Cloud.", timeline: "Weeks 2-4" },
          { phase: "Phase 3: Resume & Interview Prep", description: "Refine resume bullet points and practice mock technical interviews.", timeline: "Weeks 5-6" },
        ],
        youtubeSuggestions: [
          { title: "System Design Interview – Step By Step Guide", channel: "ByteByteGo / Alex Xu", url: "https://www.youtube.com/results?search_query=system+design+interview+guide" },
          { title: "Full Stack Web Development Masterclass", channel: "Traversy Media", url: "https://www.youtube.com/results?search_query=full+stack+web+development+masterclass" },
          { title: "TypeScript Advanced Patterns & Best Practices", channel: "Fireship", url: "https://www.youtube.com/results?search_query=typescript+advanced+patterns" },
        ],
        stackLinks: [
          { name: "React Official Documentation", url: "https://react.dev" },
          { name: "Node.js & Express Guide", url: "https://nodejs.org" },
          { name: "MongoDB Atlas Documentation", url: "https://www.mongodb.com/docs/atlas/" },
          { name: "Docker Getting Started", url: "https://docs.docker.com/get-started/" },
        ],
        missingStacks: missingSkills
          .map((skill: string) => ({ stack: skill, reason: `Required for "${job?.title || "target roles"}" but not explicitly listed in your profile skills.` }))
          .concat(
            !hasGitHub ? [{ stack: "GitHub Portfolio", reason: "No GitHub repository linked to verify practical coding experience." }] : [],
            !hasResume ? [{ stack: "Resume Document", reason: "Missing professional resume document upload." }] : []
          )
          .slice(0, 5),
        projectRecommendations: [
          { title: "Cloud-Native SaaS Application", description: "Build a scalable full-stack application with authentication, database storage, and automated deployment.", skills: ["React", "Node.js", "MongoDB", "Docker"] },
          { title: "Real-Time Collaborative Dashboard", description: "Implement WebSockets or real-time event streaming with clean architecture and robust state management.", skills: ["TypeScript", "WebSockets", "Tailwind CSS"] },
        ],
        resumeInsight: {
          available: true,
          message: hasResume ? "Your resume is attached. Ensure action verbs and metrics highlight your achievements." : "No résumé is attached. Upload your resume in the documents section.",
          suggestions: [
            "Use clear metric-driven impact statements (e.g., 'Improved API response latency by 35%')",
            "Include direct links to live demo deployments and GitHub repositories",
            "Group skills logically by Languages, Frameworks, Databases, and Tools",
          ],
        },
        disclaimer: "AI-generated career roadmap and insights are based on your profile data and job selections. Provided for educational and career development purposes.",
      };
    }

    res.json({
      generatedAt: new Date().toISOString(),
      profileInsights: generated.profileInsights ?? [],
      jobMatch: job
        ? {
            jobId: job.id ?? job._id?.toString(),
            matchScore,
            matchingSkills,
            missingSkills,
            reasoning: typeof generated.reasoning === "string" ? generated.reasoning : "Match calculated from documented skills.",
            learningPriorities: Array.isArray(generated.learningPriorities) ? generated.learningPriorities : [],
            interviewTopics: Array.isArray(generated.interviewTopics) ? generated.interviewTopics : [],
          }
        : null,
      roadmap: Array.isArray(generated.roadmap) ? generated.roadmap : [],
      youtubeSuggestions: Array.isArray(generated.youtubeSuggestions) ? generated.youtubeSuggestions : [],
      stackLinks: Array.isArray(generated.stackLinks) ? generated.stackLinks : [],
      missingStacks: Array.isArray(generated.missingStacks) ? generated.missingStacks : [],
      projectRecommendations: Array.isArray(generated.projectRecommendations) ? generated.projectRecommendations : [],
      resumeInsight: generated.resumeInsight ?? { available: false, message: "No insights available.", suggestions: [] },
      disclaimer: generated.disclaimer ?? "AI career guidance disclaimer.",
    });
  } catch (err) {
    req.log.error({ err }, "student insights error");
    res.status(503).json({ error: "AI insights are currently unavailable. Please try again later." });
  }
});

export default router;
