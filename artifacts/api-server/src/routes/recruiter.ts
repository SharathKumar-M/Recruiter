import { Router } from "express";
import { db, usersTable, jobsTable, applicationsTable, certificatesTable } from "@workspace/db";
import { eq, inArray, desc } from "drizzle-orm";
import { UpdateRecruiterProfileBody, UpdateApplicationStatusBody } from "@workspace/api-zod";
import { requireRecruiter } from "../middlewares/requireAuth";

const router = Router();

function serializeJob(j: any) {
  return {
    id: j.id, title: j.title, description: j.description, company: j.company,
    location: j.location, jobType: j.jobType, salary: j.salary, skills: j.skills ?? [],
    recruiterId: j.recruiterId, postedAt: j.postedAt instanceof Date ? j.postedAt.toISOString() : j.postedAt,
    isActive: j.isActive, applicantCount: j.applicantCount,
  };
}

async function serializeStudent(user: any) {
  const apps = await db.select({ jobId: applicationsTable.jobId }).from(applicationsTable).where(eq(applicationsTable.studentId, user.id));
  const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.studentId, user.id));
  return {
    id: user.id, displayName: user.displayName, email: user.email, role: user.role,
    college: user.college, skills: user.skills ?? [],
    linkedinUrl: user.linkedinUrl, githubUrl: user.githubUrl, portfolioUrl: user.portfolioUrl,
    resumeUrl: user.resumeUrl, resumeFilename: user.resumeFilename, photoUrl: user.photoUrl,
    appliedJobIds: apps.map((a: any) => a.jobId),
    certificates: certs.map((c: any) => ({
      id: c.id, filename: c.filename, url: c.url,
      uploadedAt: c.uploadedAt instanceof Date ? c.uploadedAt.toISOString() : c.uploadedAt,
    })),
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}

router.get("/recruiter/profile", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    res.json({
      id: user.id, displayName: user.displayName, email: user.email, role: user.role,
      companyName: user.companyName, photoUrl: user.photoUrl,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "get recruiter profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/recruiter/profile", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const parsed = UpdateRecruiterProfileBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const updates: Record<string, any> = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.companyName !== undefined) updates.companyName = parsed.data.companyName;

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    res.json({
      id: updated.id, displayName: updated.displayName, email: updated.email, role: updated.role,
      companyName: updated.companyName, photoUrl: updated.photoUrl,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "update recruiter profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/jobs", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const jobs = await db.select().from(jobsTable).where(eq(jobsTable.recruiterId, user.id)).orderBy(desc(jobsTable.postedAt));
    res.json(jobs.map(serializeJob));
  } catch (err) {
    req.log.error({ err }, "recruiter jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/applications", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const myJobs = await db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.recruiterId, user.id));
    if (myJobs.length === 0) { res.json([]); return; }

    const jobIds = myJobs.map(j => j.id);
    const apps = await db.select().from(applicationsTable).where(inArray(applicationsTable.jobId, jobIds)).orderBy(desc(applicationsTable.appliedAt));

    const studentIds = [...new Set(apps.map(a => a.studentId))];
    const students = studentIds.length > 0
      ? await db.select().from(usersTable).where(inArray(usersTable.id, studentIds))
      : [];
    const studentMap = new Map(students.map(s => [s.id, s]));

    const jobList = await db.select().from(jobsTable).where(inArray(jobsTable.id, jobIds));
    const jobMap = new Map(jobList.map(j => [j.id, j]));

    const certMap = new Map<number, any[]>();
    if (studentIds.length > 0) {
      const certs = await db.select().from(certificatesTable).where(inArray(certificatesTable.studentId, studentIds));
      for (const c of certs) {
        const arr = certMap.get(c.studentId) ?? [];
        arr.push({ id: c.id, filename: c.filename, url: c.url, uploadedAt: c.uploadedAt instanceof Date ? c.uploadedAt.toISOString() : c.uploadedAt });
        certMap.set(c.studentId, arr);
      }
    }

    const appApps = await db.select({ studentId: applicationsTable.studentId, jobId: applicationsTable.jobId }).from(applicationsTable);
    const appliedMap = new Map<number, number[]>();
    for (const a of appApps) {
      const arr = appliedMap.get(a.studentId) ?? [];
      arr.push(a.jobId);
      appliedMap.set(a.studentId, arr);
    }

    res.json(apps.map(a => {
      const s = studentMap.get(a.studentId);
      const j = jobMap.get(a.jobId);
      return {
        id: a.id, jobId: a.jobId, studentId: a.studentId, status: a.status,
        appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
        student: s ? {
          id: s.id, displayName: s.displayName, email: s.email, role: s.role,
          college: s.college, skills: s.skills ?? [],
          linkedinUrl: s.linkedinUrl, githubUrl: s.githubUrl, portfolioUrl: s.portfolioUrl,
          resumeUrl: s.resumeUrl, resumeFilename: s.resumeFilename, photoUrl: s.photoUrl,
          appliedJobIds: appliedMap.get(s.id) ?? [],
          certificates: certMap.get(s.id) ?? [],
          createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        } : null,
        job: j ? serializeJob(j) : null,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "recruiter applications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/stats", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const myJobs = await db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.recruiterId, user.id));
    const jobIds = myJobs.map(j => j.id);

    if (jobIds.length === 0) {
      res.json({ totalJobs: 0, totalApplications: 0, pendingApplications: 0, shortlistedApplications: 0, recentApplications: [] });
      return;
    }

    const apps = await db.select().from(applicationsTable).where(inArray(applicationsTable.jobId, jobIds)).orderBy(desc(applicationsTable.appliedAt));
    const pending = apps.filter(a => a.status === "pending").length;
    const shortlisted = apps.filter(a => a.status === "shortlisted").length;

    const recentApps = apps.slice(0, 5);
    const recentStudentIds = [...new Set(recentApps.map(a => a.studentId))];
    const recentStudents = recentStudentIds.length > 0
      ? await db.select().from(usersTable).where(inArray(usersTable.id, recentStudentIds))
      : [];
    const studentMap = new Map(recentStudents.map(s => [s.id, s]));
    const recentJobList = await db.select().from(jobsTable).where(inArray(jobsTable.id, jobIds));
    const jobMap = new Map(recentJobList.map(j => [j.id, j]));

    const recentApplications = recentApps.map(a => {
      const s = studentMap.get(a.studentId);
      const j = jobMap.get(a.jobId);
      return {
        id: a.id, jobId: a.jobId, studentId: a.studentId, status: a.status,
        appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
        student: s ? {
          id: s.id, displayName: s.displayName, email: s.email, role: s.role,
          college: s.college, skills: s.skills ?? [], linkedinUrl: s.linkedinUrl,
          githubUrl: s.githubUrl, portfolioUrl: s.portfolioUrl, resumeUrl: s.resumeUrl,
          resumeFilename: s.resumeFilename, photoUrl: s.photoUrl, appliedJobIds: [], certificates: [],
          createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        } : null,
        job: j ? serializeJob(j) : null,
      };
    });

    res.json({ totalJobs: myJobs.length, totalApplications: apps.length, pendingApplications: pending, shortlistedApplications: shortlisted, recentApplications });
  } catch (err) {
    req.log.error({ err }, "recruiter stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/student/:studentId", requireRecruiter, async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId as string);
    if (isNaN(studentId)) { res.status(400).json({ error: "Invalid student ID" }); return; }

    const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId)).limit(1);
    if (!student || student.role !== "student") { res.status(404).json({ error: "Student not found" }); return; }

    const apps = await db.select({ jobId: applicationsTable.jobId }).from(applicationsTable).where(eq(applicationsTable.studentId, student.id));
    const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.studentId, student.id));

    res.json({
      id: student.id, displayName: student.displayName, email: student.email, role: student.role,
      college: student.college, skills: student.skills ?? [],
      linkedinUrl: student.linkedinUrl, githubUrl: student.githubUrl, portfolioUrl: student.portfolioUrl,
      resumeUrl: student.resumeUrl, resumeFilename: student.resumeFilename, photoUrl: student.photoUrl,
      appliedJobIds: apps.map((a: any) => a.jobId),
      certificates: certs.map((c: any) => ({
        id: c.id, filename: c.filename, url: c.url,
        uploadedAt: c.uploadedAt instanceof Date ? c.uploadedAt.toISOString() : c.uploadedAt,
      })),
      createdAt: student.createdAt instanceof Date ? student.createdAt.toISOString() : student.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "get student for recruiter error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/recruiter/applications/:applicationId", requireRecruiter, async (req, res) => {
  try {
    const appId = parseInt(req.params.applicationId as string);
    if (isNaN(appId)) { res.status(400).json({ error: "Invalid application ID" }); return; }

    const parsed = UpdateApplicationStatusBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const [updated] = await db.update(applicationsTable).set({ status: parsed.data.status }).where(eq(applicationsTable.id, appId)).returning();
    if (!updated) { res.status(404).json({ error: "Application not found" }); return; }

    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, updated.jobId)).limit(1);
    res.json({
      id: updated.id, jobId: updated.jobId, studentId: updated.studentId, status: updated.status,
      appliedAt: updated.appliedAt instanceof Date ? updated.appliedAt.toISOString() : updated.appliedAt,
      job: job ? serializeJob(job) : null,
    });
  } catch (err) {
    req.log.error({ err }, "update app status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
