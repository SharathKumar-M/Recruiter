import { Router } from "express";
import {
  getUsersCollection,
  getVerificationsCollection,
  getJobsCollection,
  getNextSequence,
  toIdFilter,
} from "@workspace/db";
import { GenerateStudentInsightsBody } from "@workspace/api-zod";
import { requireRecruiter, requireStudent } from "../middlewares/requireAuth";
import { getStudentCompleteProfile } from "../lib/studentDocuments";
import { verifyGitHubProfile, verifyUrlSyntax } from "../lib/verifierTools";
import { generateStructuredAICompletion, AIProviderError } from "../lib/aiProvider";

const router = Router();

function handleAIError(err: any, req: any, res: any, defaultContext: string) {
  req.log.error({ err }, `${defaultContext} error`);

  const statusCode =
    err instanceof AIProviderError
      ? err.statusCode
      : typeof err?.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  let userFriendlyError = defaultContext;

  if (statusCode === 503) {
    userFriendlyError =
      "Gemini AI service is currently experiencing high demand and is temporarily unavailable. Please retry in a few moments.";
  } else if (statusCode === 429) {
    userFriendlyError =
      "Gemini AI rate limit or quota exceeded. Please wait a moment before trying again.";
  } else if (statusCode === 401 || statusCode === 403) {
    userFriendlyError =
      "Gemini AI authentication failed. Please verify server GEMINI_API_KEY configuration.";
  } else if (statusCode === 404) {
    userFriendlyError =
      "Gemini AI model was not found. Please verify GEMINI_MODEL configuration.";
  }

  res.status(statusCode).json({
    error: userFriendlyError,
    details: err.message || userFriendlyError,
    statusCode,
    provider: err.provider || "gemini",
    model: err.model,
    isTransient: statusCode === 503 || statusCode === 429,
  });
}

function serializeVerification(v: any) {
  return {
    id: v.id ?? v._id?.toString(),
    studentId: v.studentId,
    trustScore: v.trustScore,
    verdict: v.verdict,
    summary: v.summary,
    executiveSummary: v.executiveSummary || v.summary,
    strengths: v.strengths ?? v.verifiedStrengths ?? [],
    verifiedStrengths: v.verifiedStrengths ?? v.strengths ?? [],
    missingInformation: v.missingInformation ?? [],
    redFlags: v.redFlags ?? [],
    educationCheck: v.educationCheck ?? { status: "UNVERIFIED", detail: "Education details self-reported." },
    experienceCheck: v.experienceCheck ?? { status: "UNVERIFIED", detail: "Experience details self-reported." },
    githubCheck: v.githubCheck ?? { status: "NO_ACTIVITY", detail: "No GitHub activity verified." },
    certificatesCheck: v.certificatesCheck ?? { status: "UNVERIFIED", detail: "No certificates verified." },
    resumeAssessment: v.resumeAssessment ?? { status: "UNVERIFIED", detail: "Resume content pending analysis." },
    evidenceSources: v.evidenceSources ?? ["Profile self-reported data"],
    limitations: v.limitations ?? ["Verification limited to available public data and uploaded documents."],
    recommendation: v.recommendation ?? "Manual review recommended.",
    analysisProvider: v.analysisProvider ?? "AI Provider",
    analysisMode: v.analysisMode ?? "ai-verified",
    analyzedAt: v.analyzedAt instanceof Date ? v.analyzedAt.toISOString() : (v.analyzedAt || new Date().toISOString()),
  };
}

/**
 * Recruiter: Trigger AI verification for a candidate
 */
router.post("/ai/analyze/:studentId", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const studentParam = req.params.studentId as string;

    const profileData = await getStudentCompleteProfile(studentParam);
    if (!profileData || profileData.user.role !== "student") {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const { user, resume, certificates, projects, experience } = profileData;

    // Genuine public GitHub verification
    const githubResult = await verifyGitHubProfile(user.githubUrl);

    // Validate URL syntax
    const linkedinValidation = verifyUrlSyntax(user.linkedinUrl);
    const portfolioValidation = verifyUrlSyntax(user.portfolioUrl);

    // Build evidence-based context
    const hasResumeText = Boolean(resume.extracted && resume.text && resume.text.length > 50);
    const resumeTextSnippet = hasResumeText
      ? resume.text!.slice(0, 3500)
      : resume.document
      ? `[Document uploaded as "${resume.filename}", but text extraction failed: ${resume.reason || "Non-text or scanned PDF"}]`
      : "[No resume document uploaded to date]";

    const documentedSkills = (user.skills ?? []).join(", ") || "None declared";
    const programmingLanguages = (user.programmingLanguages ?? []).join(", ") || "None declared";
    const frameworks = (user.frameworks ?? []).join(", ") || "None declared";
    const databases = (user.databases ?? []).join(", ") || "None declared";
    const tools = (user.tools ?? []).join(", ") || "None declared";

    const projectsSummary = projects.length > 0
      ? projects.map((p, i) => `${i + 1}. ${p.title}: ${p.description || "No description"} (Technologies: ${(p.technologies ?? []).join(", ") || "None"})`).join("\n")
      : "No projects listed on platform.";

    const experienceSummary = experience.length > 0
      ? experience.map((e, i) => `${i + 1}. ${e.role} at ${e.organization} (${e.startDate || ""} - ${e.endDate || (e.current ? "Present" : "")}): ${e.description || ""}`).join("\n")
      : "No work experience listed on platform.";

    const certsSummary = certificates.length > 0
      ? certificates.map((c, i) => `${i + 1}. ${c.title || c.filename || "Certificate"} (Issuer: ${c.issuingOrganization || "Self-uploaded"})`).join("\n")
      : "No certificates uploaded.";

    const systemPrompt = `You are VERIF-AI, an objective senior technical recruitment auditor.
Your job is to rigorously evaluate a candidate's credentials for recruiters.

CRITICAL VERIFICATION RULES:
1. Clearly distinguish verifiable evidence from self-reported claims.
2. For GitHub: Rely on the verified GitHub metadata provided.
3. For LinkedIn: Acknowledge the URL exists if provided, but NEVER claim to have verified LinkedIn profile content or work history as private scraping is not supported.
4. For Certificates: Acknowledge uploaded certificate files, but treat them as self-uploaded documents requiring human issuer validation.
5. For Resume: Note whether actual resume text was parsed or missing.
6. Do NOT invent strengths, degrees, work history, or claims not present in the data.
7. Trust score must be between 0 and 100, supported by transparent factors.
8. Verdict must be one of: "AUTHENTIC", "LIKELY_AUTHENTIC", "SUSPICIOUS", "UNVERIFIED".
   - "AUTHENTIC": Multiple strong independent verifications (active verified GitHub + parsed resume + consistent projects).
   - "LIKELY_AUTHENTIC": Solid profile with good consistency, though some elements rely on self-reporting.
   - "UNVERIFIED": Incomplete profile (missing resume or no GitHub activity) where claims cannot yet be substantiated.
   - "SUSPICIOUS": Direct contradictions or broken/counterfeit link patterns.

Generate a JSON object with this exact structure:
{
  "trustScore": <number 0-100>,
  "verdict": "<AUTHENTIC|LIKELY_AUTHENTIC|SUSPICIOUS|UNVERIFIED>",
  "summary": "<2-3 sentence executive summary>",
  "executiveSummary": "<Detailed evaluation paragraph highlighting verifiable highlights and gaps>",
  "verifiedStrengths": ["<verifiable strength 1>", "<verifiable strength 2>"],
  "missingInformation": ["<missing or unverifiable claim 1>", "<missing claim 2>"],
  "redFlags": ["<concern or red flag 1>"],
  "educationAssessment": {
    "status": "<VERIFIED|SELF_REPORTED|UNVERIFIED>",
    "detail": "<Explanation of education verification status>"
  },
  "experienceAssessment": {
    "status": "<DOCUMENTED|SELF_REPORTED|UNVERIFIED>",
    "detail": "<Explanation of experience verification status>"
  },
  "githubAssessment": {
    "status": "<AUTHENTIC|NO_ACTIVITY|NOT_FOUND|UNVERIFIED>",
    "detail": "<Explanation based on real GitHub data>",
    "publicRepos": <number>,
    "topLanguages": ["<lang1>", "<lang2>"]
  },
  "certificateAssessment": {
    "status": "<UPLOADED_PENDING_AUDIT|NONE>",
    "detail": "<Explanation of certificates provided>"
  },
  "resumeAssessment": {
    "status": "<EXTRACTED_AND_VERIFIED|UPLOADED_UNPARSED|MISSING>",
    "detail": "<Assessment of resume content and clarity>"
  },
  "evidenceSources": ["<source 1>", "<source 2>"],
  "limitations": ["<limitation 1, e.g. LinkedIn private data unverified>", "<limitation 2>"],
  "recommendation": "<Specific, actionable next step for recruiter interviewers>"
}`;

    const userPrompt = `CANDIDATE DOSSIER:
Full Name: ${user.displayName}
Email: ${user.email}
College: ${user.college || "Not specified"}
Degree: ${user.degree || "Not specified"}
Branch / Major: ${user.branch || "Not specified"}
Graduation Year: ${user.graduationYear || "Not specified"}
Location: ${user.location || "Not specified"}
Professional Summary: ${user.professionalSummary || "None provided"}

SELF-REPORTED SKILLS & STACKS:
- Core Skills: ${documentedSkills}
- Programming Languages: ${programmingLanguages}
- Frameworks: ${frameworks}
- Databases: ${databases}
- Tools: ${tools}

EXTERNAL LINKS:
- GitHub URL: ${user.githubUrl || "Not provided"}
- GitHub API Check: ${JSON.stringify(githubResult)}
- LinkedIn URL: ${user.linkedinUrl || "Not provided"} (Syntax Valid: ${linkedinValidation.valid})
- Portfolio URL: ${user.portfolioUrl || "Not provided"} (Syntax Valid: ${portfolioValidation.valid})

RESUME DOCUMENT:
- Filename: ${resume.filename || "None"}
- Text Extracted: ${hasResumeText ? "YES" : "NO"}
- Resume Text Content:
${resumeTextSnippet}

UPLOADED CERTIFICATES (${certificates.length}):
${certsSummary}

PORTFOLIO PROJECTS (${projects.length}):
${projectsSummary}

DOCUMENTED WORK EXPERIENCE (${experience.length}):
${experienceSummary}`;

    const aiResponse = await generateStructuredAICompletion<any>({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 3500,
    });

    const aiResult = aiResponse.data;
    const now = new Date();
    const verificationsCol = await getVerificationsCollection();
    const seqId = await getNextSequence("verifications");

    const newVerification = {
      id: seqId,
      studentId: user.id ?? user._id,
      recruiterId: recruiter.id ?? recruiter._id,
      trustScore: typeof aiResult.trustScore === "number" ? Math.max(0, Math.min(100, Math.round(aiResult.trustScore))) : 50,
      verdict: aiResult.verdict || "UNVERIFIED",
      summary: aiResult.summary || "Candidate verification completed.",
      executiveSummary: aiResult.executiveSummary || aiResult.summary,
      strengths: Array.isArray(aiResult.verifiedStrengths) ? aiResult.verifiedStrengths : (aiResult.strengths ?? []),
      verifiedStrengths: Array.isArray(aiResult.verifiedStrengths) ? aiResult.verifiedStrengths : [],
      missingInformation: Array.isArray(aiResult.missingInformation) ? aiResult.missingInformation : [],
      redFlags: Array.isArray(aiResult.redFlags) ? aiResult.redFlags : [],
      educationCheck: aiResult.educationAssessment ?? aiResult.educationCheck ?? { status: "SELF_REPORTED", detail: "Self-reported by candidate." },
      experienceCheck: aiResult.experienceAssessment ?? aiResult.experienceCheck ?? { status: "SELF_REPORTED", detail: "Experience claims documented in portal." },
      githubCheck: {
        ...(aiResult.githubAssessment ?? aiResult.githubCheck ?? {}),
        publicRepos: githubResult.publicRepos ?? 0,
        followers: githubResult.followers ?? 0,
        topLanguages: githubResult.topLanguages ?? [],
      },
      certificatesCheck: aiResult.certificateAssessment ?? aiResult.certificatesCheck ?? { status: certificates.length ? "UPLOADED_PENDING_AUDIT" : "NONE", detail: `${certificates.length} certificate(s) uploaded.` },
      resumeAssessment: aiResult.resumeAssessment ?? {
        status: hasResumeText ? "EXTRACTED_AND_VERIFIED" : resume.document ? "UPLOADED_UNPARSED" : "MISSING",
        detail: hasResumeText ? `Parsed ${resume.text!.length} characters from resume.` : "No readable resume text available.",
      },
      evidenceSources: Array.isArray(aiResult.evidenceSources)
        ? aiResult.evidenceSources
        : [
            ...(hasResumeText ? ["Uploaded Resume text extraction"] : []),
            ...(githubResult.verified ? ["GitHub Public User & Repositories API"] : []),
            "VERIF-AI Student Profile Data",
          ],
      limitations: Array.isArray(aiResult.limitations)
        ? aiResult.limitations
        : [
            "LinkedIn profile contents cannot be independently inspected without member OAuth.",
            "Certificates are user-provided files requiring official issuer verification.",
          ],
      recommendation: aiResult.recommendation || "Proceed with direct technical interview to verify competencies.",
      analysisProvider: aiResponse.provider,
      analysisMode: "ai-verified",
      analyzedAt: now,
    };

    const insertResult = await verificationsCol.insertOne(newVerification);

    res.json(serializeVerification({ ...newVerification, _id: insertResult.insertedId }));
  } catch (err: any) {
    handleAIError(err, req, res, "AI Verification Failed");
  }
});

/**
 * Recruiter: Retrieve latest verification result
 */
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

/**
 * Student: Generate personalized career insights
 */
router.post("/ai/student-insights", requireStudent, async (req, res) => {
  try {
    const parsed = GenerateStudentInsightsBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error });
      return;
    }

    const studentUser = (req as any).dbUser;
    const profileData = await getStudentCompleteProfile(studentUser);
    if (!profileData) {
      res.status(404).json({ error: "Student profile not found" });
      return;
    }

    const { user, resume, certificates, projects, experience } = profileData;

    const jobsCol = await getJobsCollection();
    const jobId = parsed.data.jobId;
    const job = jobId ? await jobsCol.findOne(toIdFilter(jobId)) : null;

    if (jobId && (!job || !job.isActive)) {
      res.status(404).json({ error: "Active job not found" });
      return;
    }

    // Determine candidate documented skills
    const documentedSkills = (user.skills ?? []).map((s: string) => s.trim()).filter(Boolean);
    const requiredSkills: string[] = job?.skills ?? [];

    const normalizedStudentSkills = new Set([
      ...documentedSkills.map((s: string) => s.toLowerCase()),
      ...(user.programmingLanguages ?? []).map((s: string) => s.toLowerCase()),
      ...(user.frameworks ?? []).map((s: string) => s.toLowerCase()),
      ...(user.databases ?? []).map((s: string) => s.toLowerCase()),
      ...(user.tools ?? []).map((s: string) => s.toLowerCase()),
    ]);

    const matchingSkills = requiredSkills.filter((skill: string) =>
      normalizedStudentSkills.has(skill.toLowerCase())
    );
    const missingSkills = requiredSkills.filter((skill: string) =>
      !normalizedStudentSkills.has(skill.toLowerCase())
    );

    const matchScore = job
      ? requiredSkills.length > 0
        ? Math.round((matchingSkills.length / requiredSkills.length) * 100)
        : 70
      : null;

    const hasResumeText = Boolean(resume.extracted && resume.text && resume.text.length > 50);
    const resumeTextSnippet = hasResumeText
      ? resume.text!.slice(0, 3000)
      : resume.document
      ? `[Resume uploaded as "${resume.filename}", but text extraction was not possible: ${resume.reason || "Scanned image"}]`
      : "[No resume uploaded to date]";

    const projectsSummary = projects.length > 0
      ? projects.map((p, i) => `${i + 1}. ${p.title} (${(p.technologies ?? []).join(", ") || "Stack unlisted"}): ${p.description}`).join("\n")
      : "No projects recorded.";

    const experienceSummary = experience.length > 0
      ? experience.map((e, i) => `${i + 1}. ${e.role} at ${e.organization}: ${e.description || ""}`).join("\n")
      : "No work experience recorded.";

    const systemPrompt = `You are a supportive, high-caliber software engineering career coach and technical mentor.
Your objective is to provide personalized, high-impact career insights and a structured roadmap.

RULES:
1. Ground recommendations in the candidate's actual projects, experience, declared skills, and resume content.
2. If a target job is provided, analyze the specific gap between the candidate's stack and that job.
3. If no job is provided, recommend modern, production-grade industry skills and full-stack architecture patterns.
4. If a resume is attached, provide specific, high-value resume bullet improvement tips. If missing, emphasize uploading a resume.
5. Return ONLY a valid JSON object matching the requested schema.`;

    const userPrompt = `STUDENT PROFILE:
Name: ${user.displayName}
Education: ${user.degree || "Degree"} in ${user.branch || "Engineering"} at ${user.college || "University"} (Grad: ${user.graduationYear || "N/A"})
Declared Skills: ${documentedSkills.join(", ") || "None"}
Languages: ${(user.programmingLanguages ?? []).join(", ") || "None"}
Frameworks: ${(user.frameworks ?? []).join(", ") || "None"}
Databases: ${(user.databases ?? []).join(", ") || "None"}
Tools: ${(user.tools ?? []).join(", ") || "None"}
GitHub Link: ${user.githubUrl || "None"}
LinkedIn Link: ${user.linkedinUrl || "None"}
Certificates: ${certificates.length} uploaded

RESUME CONTENT:
${resumeTextSnippet}

PROJECTS:
${projectsSummary}

EXPERIENCE:
${experienceSummary}

TARGET ROLE CONTEXT:
${job ? JSON.stringify({ title: job.title, company: job.company, description: job.description, requiredSkills, matchingSkills, missingSkills }) : "General Full-Stack Software Engineering Career Development"}

Generate a JSON object with this exact schema:
{
  "profileInsights": ["<Specific profile insight 1>", "<Specific profile insight 2>", "<Specific profile insight 3>"],
  "reasoning": "<Clear explanation of skill alignment or career trajectory>",
  "learningPriorities": ["<Priority skill 1>", "<Priority skill 2>", "<Priority skill 3>"],
  "interviewTopics": ["<Technical interview topic 1>", "<System design topic 2>", "<Behavioral topic 3>"],
  "roadmap": [
    {"phase": "Phase 1: Foundation & Core Gaps", "description": "<Actionable goal>", "timeline": "Weeks 1-2"},
    {"phase": "Phase 2: Portfolio Projects & Architecture", "description": "<Actionable goal>", "timeline": "Weeks 3-5"},
    {"phase": "Phase 3: Production Deployments & System Design", "description": "<Actionable goal>", "timeline": "Weeks 6-8"}
  ],
  "youtubeSuggestions": [
    {"title": "<Real high-value tutorial title>", "channel": "<Well-known channel, e.g. NeetCode, Traversy Media, Fireship, ByteByteGo>", "url": "https://www.youtube.com/results?search_query=..."}
  ],
  "stackLinks": [
    {"name": "<Technology Docs>", "url": "https://..."}
  ],
  "missingStacks": [
    {"stack": "<Tech/Concept>", "reason": "<Why it is critical for this student's target level>"}
  ],
  "projectRecommendations": [
    {"title": "<Portfolio Project Idea>", "description": "<Detailed implementation plan>", "skills": ["<Skill 1>", "<Skill 2>"]}
  ],
  "resumeInsight": {
    "available": ${Boolean(resume.document || user.resumeUrl)},
    "message": "<Clear assessment of resume status>",
    "suggestions": [
      "<Resume bullet tip 1>",
      "<Resume bullet tip 2>",
      "<Resume bullet tip 3>"
    ]
  },
  "disclaimer": "Career insights are generated using AI analysis of your student profile, extracted resume content, and real job requirements."
}`;

    const aiResponse = await generateStructuredAICompletion<any>({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 3500,
    });

    const generated = aiResponse.data;

    res.json({
      generatedAt: new Date().toISOString(),
      analysisProvider: aiResponse.provider,
      analysisModel: aiResponse.model,
      profileInsights: Array.isArray(generated.profileInsights) ? generated.profileInsights : [],
      jobMatch: job
        ? {
            jobId: job.id ?? job._id?.toString(),
            jobTitle: job.title,
            company: job.company,
            matchScore,
            matchingSkills,
            missingSkills,
            reasoning: typeof generated.reasoning === "string" ? generated.reasoning : "Calculated from skill requirements.",
            learningPriorities: Array.isArray(generated.learningPriorities) ? generated.learningPriorities : [],
            interviewTopics: Array.isArray(generated.interviewTopics) ? generated.interviewTopics : [],
          }
        : null,
      roadmap: Array.isArray(generated.roadmap) ? generated.roadmap : [],
      youtubeSuggestions: Array.isArray(generated.youtubeSuggestions) ? generated.youtubeSuggestions : [],
      stackLinks: Array.isArray(generated.stackLinks) ? generated.stackLinks : [],
      missingStacks: Array.isArray(generated.missingStacks) ? generated.missingStacks : [],
      projectRecommendations: Array.isArray(generated.projectRecommendations) ? generated.projectRecommendations : [],
      resumeInsight: generated.resumeInsight ?? {
        available: Boolean(resume.document || user.resumeUrl),
        message: resume.document ? "Resume attached to profile." : "No resume document uploaded.",
        suggestions: ["Upload your updated resume to receive personalized line-by-line feedback."],
      },
      disclaimer: generated.disclaimer ?? "Career insights generated by AI for educational purposes.",
    });
  } catch (err: any) {
    handleAIError(err, req, res, "Failed to generate AI insights");
  }
});

export default router;
