import { Router } from "express";
import {
  db,
  usersTable,
  applicationsTable,
  jobsTable,
  certificatesTable,
  verificationsTable,
  studentProjectsTable,
  studentExperienceTable,
  documentsTable,
  notificationsTable
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { UpdateStudentProfileBody } from "@workspace/api-zod";
import { requireStudent } from "../middlewares/requireAuth";

const router = Router();

function serializeStudent(user: any, appliedJobIds: number[], certificates: any[]) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    college: user.college,
    location: user.location,
    graduationYear: user.graduationYear,
    professionalSummary: user.professionalSummary,
    skills: user.skills ?? [],
    linkedinUrl: user.linkedinUrl,
    githubUrl: user.githubUrl,
    portfolioUrl: user.portfolioUrl,
    resumeUrl: user.resumeUrl,
    resumeFilename: user.resumeFilename,
    photoUrl: user.photoUrl,
    appliedJobIds,
    certificates: certificates.map(c => ({
      id: c.id,
      filename: c.filename,
      url: c.url,
      uploadedAt: c.uploadedAt instanceof Date ? c.uploadedAt.toISOString() : c.uploadedAt,
    })),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}

router.get("/student/profile", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const apps = await db.select({ jobId: applicationsTable.jobId }).from(applicationsTable).where(eq(applicationsTable.studentId, user.id));
    const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.studentId, user.id));
    res.json(serializeStudent(user, apps.map(a => a.jobId), certs));
  } catch (err) {
    req.log.error({ err }, "get student profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/student/profile", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const parsed = UpdateStudentProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.format() });
      return;
    }

    const updates: Record<string, any> = {};
    const data = parsed.data;
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.college !== undefined) updates.college = data.college;
    if (data.skills !== undefined) updates.skills = data.skills;
    if (data.linkedinUrl !== undefined) updates.linkedinUrl = data.linkedinUrl;
    if (data.githubUrl !== undefined) updates.githubUrl = data.githubUrl;
    if (data.portfolioUrl !== undefined) updates.portfolioUrl = data.portfolioUrl;
    if ((data as any).location !== undefined) updates.location = (data as any).location;
    if ((data as any).graduationYear !== undefined) updates.graduationYear = (data as any).graduationYear;
    if ((data as any).professionalSummary !== undefined) updates.professionalSummary = (data as any).professionalSummary;

    const [updated] = await db.transaction(async (tx) => {
      const [resUser] = await tx.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
      return [resUser];
    });

    const apps = await db.select({ jobId: applicationsTable.jobId }).from(applicationsTable).where(eq(applicationsTable.studentId, user.id));
    const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.studentId, user.id));
    res.json(serializeStudent(updated, apps.map(a => a.jobId), certs));
  } catch (err) {
    req.log.error({ err }, "update student profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/stats", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const apps = await db.select().from(applicationsTable).where(eq(applicationsTable.studentId, user.id)).orderBy(desc(applicationsTable.appliedAt));

    const total = apps.length;
    const pending = apps.filter(a => a.status === "pending").length;
    const shortlisted = apps.filter(a => a.status === "shortlisted").length;

    let completion = 20;
    if (user.displayName) completion += 10;
    if (user.college) completion += 15;
    if (user.skills && user.skills.length > 0) completion += 15;
    if (user.resumeUrl) completion += 20;
    if (user.linkedinUrl) completion += 10;
    if (user.githubUrl) completion += 10;
    if (user.photoUrl) completion = Math.min(100, completion + 10);

    const recentJobIds = apps.slice(0, 5).map(a => a.jobId);
    let jobsMap = new Map<number, any>();
    if (recentJobIds.length > 0) {
      const recentJobs = await db.select().from(jobsTable).where(eq(jobsTable.id, recentJobIds[0]));
      for (const j of recentJobs) jobsMap.set(j.id, {
        id: j.id, title: j.title, company: j.company, location: j.location,
        jobType: j.jobType, salary: j.salary, skills: j.skills ?? [],
        recruiterId: j.recruiterId, postedAt: j.postedAt instanceof Date ? j.postedAt.toISOString() : j.postedAt,
        isActive: j.isActive, applicantCount: j.applicantCount, description: j.description,
      });
    }

    const recentApplications = apps.slice(0, 5).map(a => ({
      id: a.id, jobId: a.jobId, studentId: a.studentId, status: a.status,
      appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
      job: jobsMap.get(a.jobId) ?? null,
    }));

    res.json({ totalApplications: total, pendingApplications: pending, shortlistedApplications: shortlisted, profileCompletion: completion, recentApplications });
  } catch (err) {
    req.log.error({ err }, "student stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Projects CRUD for student
router.get("/student/projects", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projects = await db.select().from(studentProjectsTable).where(eq(studentProjectsTable.studentId, user.id));
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "get student projects error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/student/projects", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { title, description, technologies, githubUrl, liveUrl } = req.body ?? {};
    if (!title || !description) {
      res.status(400).json({ error: "Title and description are required" });
      return;
    }

    const [project] = await db.insert(studentProjectsTable).values({
      studentId: user.id,
      title: String(title),
      description: String(description),
      technologies: Array.isArray(technologies) ? technologies.map(String) : [],
      githubUrl: githubUrl ? String(githubUrl) : null,
      liveUrl: liveUrl ? String(liveUrl) : null,
    }).returning();

    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "create student project error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/projects/:id", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(req.params.id as string);
    if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

    const [deleted] = await db.delete(studentProjectsTable)
      .where(and(eq(studentProjectsTable.id, projectId), eq(studentProjectsTable.studentId, user.id)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Project not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "delete student project error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Experience CRUD for student
router.get("/student/experience", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const experience = await db.select().from(studentExperienceTable).where(eq(studentExperienceTable.studentId, user.id));
    res.json(experience);
  } catch (err) {
    req.log.error({ err }, "get student experience error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/student/experience", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { organization, role, description, startDate, endDate, current } = req.body ?? {};
    if (!organization || !role || !description || !startDate) {
      res.status(400).json({ error: "Organization, role, description, and start date are required" });
      return;
    }

    const [exp] = await db.insert(studentExperienceTable).values({
      studentId: user.id,
      organization: String(organization),
      role: String(role),
      description: String(description),
      startDate: String(startDate),
      endDate: endDate ? String(endDate) : null,
      current: Boolean(current),
    }).returning();

    res.status(201).json(exp);
  } catch (err) {
    req.log.error({ err }, "create student experience error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/experience/:id", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const expId = parseInt(req.params.id as string);
    if (isNaN(expId)) { res.status(400).json({ error: "Invalid experience ID" }); return; }

    const [deleted] = await db.delete(studentExperienceTable)
      .where(and(eq(studentExperienceTable.id, expId), eq(studentExperienceTable.studentId, user.id)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Experience not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "delete student experience error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Documents CRUD for student
router.get("/student/documents", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const docs = await db.select().from(documentsTable).where(eq(documentsTable.studentId, user.id));
    res.json(docs);
  } catch (err) {
    req.log.error({ err }, "get student documents error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/student/documents", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { documentType, filename, url, metadata } = req.body ?? {};
    if (!documentType || !filename || !url) {
      res.status(400).json({ error: "Document type, filename, and URL are required" });
      return;
    }

    const [doc] = await db.insert(documentsTable).values({
      studentId: user.id,
      documentType: String(documentType),
      filename: String(filename),
      url: String(url),
      metadata: metadata ? String(metadata) : null,
    }).returning();

    res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "upload document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/documents/:id", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const docId = parseInt(req.params.id as string);
    if (isNaN(docId)) { res.status(400).json({ error: "Invalid document ID" }); return; }

    const [deleted] = await db.delete(documentsTable)
      .where(and(eq(documentsTable.id, docId), eq(documentsTable.studentId, user.id)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "delete document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Notifications for student
router.get("/student/notifications", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const notifs = await db.select().from(notificationsTable).where(eq(notificationsTable.studentId, user.id)).orderBy(desc(notificationsTable.createdAt));
    res.json(notifs);
  } catch (err) {
    req.log.error({ err }, "get notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/student/notifications/:id/read", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const notifId = parseInt(req.params.id as string);
    if (isNaN(notifId)) { res.status(400).json({ error: "Invalid notification ID" }); return; }

    const [updated] = await db.update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, notifId), eq(notificationsTable.studentId, user.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Notification not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "mark notification read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

router.get("/student/ai-result", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const [result] = await db.select().from(verificationsTable)
      .where(eq(verificationsTable.studentId, user.id))
      .orderBy(desc(verificationsTable.analyzedAt))
      .limit(1);

    if (!result) {
      res.status(404).json({ error: "No verification result found" });
      return;
    }

    res.json(serializeVerification(result));
  } catch (err) {
    req.log.error({ err }, "get student ai result error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
