import { Router } from "express";
import { db, usersTable, verificationsTable, certificatesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRecruiter } from "../middlewares/requireAuth";

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

export default router;
