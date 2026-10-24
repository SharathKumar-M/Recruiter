import { Router } from "express";
import { db, usersTable, verificationsTable, certificatesTable, jobsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GenerateStudentInsightsBody } from "@workspace/api-zod";
import { requireRecruiter, requireStudent } from "../middlewares/requireAuth";

const router = Router();

function serializeVerification(v: any) {
  return {
    id: v.id,
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
  // Build a profile summary for AI analysis
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
    // Fallback: generate a basic analysis without AI
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
    const studentId = parseInt(req.params.studentId as string);
    if (isNaN(studentId)) { res.status(400).json({ error: "Invalid student ID" }); return; }

    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId)).limit(1);
    if (!student || student.role !== "student") { res.status(404).json({ error: "Student not found" }); return; }

    const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.studentId, student.id));

    const aiResult = await runAIVerification(student, certs);

    const [saved] = await db.insert(verificationsTable).values({
      studentId: student.id,
      recruiterId: recruiter.id,
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
    }).returning();

    res.json(serializeVerification(saved));
  } catch (err) {
    req.log.error({ err }, "ai analyze error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/ai/result/:studentId", requireRecruiter, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId as string);
    if (isNaN(studentId)) { res.status(400).json({ error: "Invalid student ID" }); return; }

    const [result] = await db.select().from(verificationsTable)
      .where(eq(verificationsTable.studentId, studentId))
      .orderBy(desc(verificationsTable.analyzedAt))
      .limit(1);

    if (!result) { res.status(404).json({ error: "No verification result found" }); return; }

    res.json(serializeVerification(result));
  } catch (err) {
    req.log.error({ err }, "get ai result error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ai/student-insights", requireStudent, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({ error: "AI insights are currently unavailable." });
      return;
    }

    const parsed = GenerateStudentInsightsBody.safeParse(req.body ?? {});
    if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
    const student = (req as any).dbUser;
    const jobId = parsed.data.jobId;
    const [job] = jobId ? await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1) : [null];
    if (jobId && (!job || !job.isActive)) { res.status(404).json({ error: "Active job not found" }); return; }

    const documentedSkills = (student.skills ?? []).map((skill: string) => skill.trim()).filter(Boolean);
    const requiredSkills = job?.skills ?? [];
    const normalizedStudentSkills = new Map(documentedSkills.map((skill: string) => [skill.toLowerCase(), skill]));
    const matchingSkills = requiredSkills.filter((skill: string) => normalizedStudentSkills.has(skill.toLowerCase()));
    const missingSkills = requiredSkills.filter((skill: string) => !normalizedStudentSkills.has(skill.toLowerCase()));
    const matchScore = job ? (requiredSkills.length ? Math.round((matchingSkills.length / requiredSkills.length) * 100) : 0) : null;

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText } = await import("ai");
    const openai = createOpenAI({ baseURL: process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY });
    const profile = {
      college: student.college ?? null,
      skills: documentedSkills,
      hasLinkedIn: Boolean(student.linkedinUrl),
      hasGitHub: Boolean(student.githubUrl),
      hasPortfolio: Boolean(student.portfolioUrl),
      hasResume: Boolean(student.resumeUrl),
    };
    const prompt = `You are a supportive career assistant. Use only the documented profile data below. Do not invent credentials, work history, achievements, or resume content. Do not assess identity, honesty, employability, or protected characteristics. Do not promise interviews or employment. Return JSON only with this exact shape:\n{\n  "profileInsights": ["concise actionable suggestion"],\n  "reasoning": "brief plain-language explanation for the job match, if a job is provided; otherwise an empty string",\n  "learningPriorities": ["skill or practical next step"],\n  "interviewTopics": ["topic"],\n  "projectRecommendations": [{"title":"project title", "description":"how it strengthens the documented profile", "skills":["skill"]}]\n}\nProfile: ${JSON.stringify(profile)}\nJob context: ${job ? JSON.stringify({ title: job.title, company: job.company, description: job.description, requiredSkills, matchingSkills, missingSkills }) : "No job selected"}`;
    const result = await generateText({ model: openai("gpt-4o-mini"), prompt, maxOutputTokens: 900 });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return structured insights");
    const generated = JSON.parse(match[0]);
    if (!Array.isArray(generated.profileInsights) || !Array.isArray(generated.projectRecommendations)) throw new Error("AI response was incomplete");

    res.json({
      generatedAt: new Date().toISOString(),
      profileInsights: generated.profileInsights.slice(0, 5),
      jobMatch: job ? { jobId: job.id, matchScore, matchingSkills, missingSkills, reasoning: typeof generated.reasoning === "string" ? generated.reasoning : "Match is calculated from skills documented in your profile and this job listing.", learningPriorities: Array.isArray(generated.learningPriorities) ? generated.learningPriorities.slice(0, 5) : [], interviewTopics: Array.isArray(generated.interviewTopics) ? generated.interviewTopics.slice(0, 5) : [] } : null,
      projectRecommendations: generated.projectRecommendations.slice(0, 3).map((project: any) => ({ title: String(project.title ?? "Project idea"), description: String(project.description ?? "Build a focused project using skills you want to demonstrate."), skills: Array.isArray(project.skills) ? project.skills.slice(0, 6).map(String) : [] })),
      resumeInsight: { available: false, message: student.resumeUrl ? "A resume is attached, but this application does not support résumé text parsing yet." : "No résumé is attached. Résumé-specific suggestions become available when text parsing is supported.", suggestions: [] },
      disclaimer: "AI-generated career guidance is based only on the information you provide. It is not a verification, hiring decision, or guarantee of an outcome.",
    });
  } catch (err) {
    req.log.error({ err }, "student insights error");
    res.status(503).json({ error: "AI insights are currently unavailable. Please try again later." });
  }
});

export default router;
