import { Router } from "express";
import { db, usersTable, applicationsTable, jobsTable, certificatesTable } from "@workspace/db";
import { eq, inArray, desc } from "drizzle-orm";
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
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const updates: Record<string, any> = {};
    const data = parsed.data;
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.college !== undefined) updates.college = data.college;
    if (data.skills !== undefined) updates.skills = data.skills;
    if (data.linkedinUrl !== undefined) updates.linkedinUrl = data.linkedinUrl;
    if (data.githubUrl !== undefined) updates.githubUrl = data.githubUrl;
    if (data.portfolioUrl !== undefined) updates.portfolioUrl = data.portfolioUrl;

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
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

    // Profile completion calculation
    let completion = 20; // base for having an account
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
      const recentJobs = await db.select().from(jobsTable).where(inArray(jobsTable.id, recentJobIds));
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

export default router;
