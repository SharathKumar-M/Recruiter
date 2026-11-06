import { Router } from "express";
import {
  db,
  usersTable,
  jobsTable,
  applicationsTable,
  certificatesTable,
  recruiterNotesTable,
  candidateScorecardsTable,
  interviewsTable,
  talentPoolsTable,
  talentPoolMembersTable,
  auditLogsTable
} from "@workspace/db";
import { eq, inArray, desc, and, or, ilike, sql } from "drizzle-orm";
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

// Notes CRUD (Recruiter private)
router.get("/recruiter/applications/:applicationId/notes", requireRecruiter, async (req, res) => {
  try {
    const appId = parseInt(req.params.applicationId as string);
    const notes = await db.select().from(recruiterNotesTable).where(eq(recruiterNotesTable.applicationId, appId));
    res.json(notes);
  } catch (err) {
    req.log.error({ err }, "get notes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recruiter/applications/:applicationId/notes", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const appId = parseInt(req.params.applicationId as string);
    const { note, tags } = req.body ?? {};
    if (!note) { res.status(400).json({ error: "Note content is required" }); return; }

    const [created] = await db.insert(recruiterNotesTable).values({
      applicationId: appId,
      recruiterId: recruiter.id,
      note: String(note),
      tags: Array.isArray(tags) ? tags.map(String) : [],
    }).returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "create note error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/recruiter/notes/:noteId", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const noteId = parseInt(req.params.noteId as string);
    const [deleted] = await db.delete(recruiterNotesTable)
      .where(and(eq(recruiterNotesTable.id, noteId), eq(recruiterNotesTable.recruiterId, recruiter.id)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Note not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "delete note error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Scorecards
router.get("/recruiter/applications/:applicationId/scorecard", requireRecruiter, async (req, res) => {
  try {
    const appId = parseInt(req.params.applicationId as string);
    const [scorecard] = await db.select().from(candidateScorecardsTable).where(eq(candidateScorecardsTable.applicationId, appId)).limit(1);
    res.json(scorecard || null);
  } catch (err) {
    req.log.error({ err }, "get scorecard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/recruiter/applications/:applicationId/scorecard", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const appId = parseInt(req.params.applicationId as string);
    const { technicalSkills, communication, problemSolving, cultureFit, overallRating, feedback } = req.body ?? {};

    const [existing] = await db.select().from(candidateScorecardsTable).where(eq(candidateScorecardsTable.applicationId, appId)).limit(1);

    if (existing) {
      const [updated] = await db.update(candidateScorecardsTable).set({
        technicalSkills: technicalSkills !== undefined ? Number(technicalSkills) : existing.technicalSkills,
        communication: communication !== undefined ? Number(communication) : existing.communication,
        problemSolving: problemSolving !== undefined ? Number(problemSolving) : existing.problemSolving,
        cultureFit: cultureFit !== undefined ? Number(cultureFit) : existing.cultureFit,
        overallRating: overallRating !== undefined ? Number(overallRating) : existing.overallRating,
        feedback: feedback !== undefined ? String(feedback) : existing.feedback,
      }).where(eq(candidateScorecardsTable.id, existing.id)).returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(candidateScorecardsTable).values({
        applicationId: appId,
        recruiterId: recruiter.id,
        technicalSkills: Number(technicalSkills ?? 0),
        communication: Number(communication ?? 0),
        problemSolving: Number(problemSolving ?? 0),
        cultureFit: Number(cultureFit ?? 0),
        overallRating: Number(overallRating ?? 0),
        feedback: feedback ? String(feedback) : null,
      }).returning();
      res.status(201).json(created);
    }
  } catch (err) {
    req.log.error({ err }, "upsert scorecard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Interviews
router.get("/recruiter/interviews", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const list = await db.select().from(interviewsTable).where(eq(interviewsTable.recruiterId, recruiter.id)).orderBy(desc(interviewsTable.scheduledAt));
    res.json(list);
  } catch (err) {
    req.log.error({ err }, "get interviews error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recruiter/interviews", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const { applicationId, studentId, scheduledAt, durationMinutes, mode, locationOrLink, notes } = req.body ?? {};
    if (!applicationId || !studentId || !scheduledAt) {
      res.status(400).json({ error: "Application ID, student ID, and scheduled time are required" });
      return;
    }

    const [interview] = await db.insert(interviewsTable).values({
      applicationId: Number(applicationId),
      recruiterId: recruiter.id,
      studentId: Number(studentId),
      scheduledAt: String(scheduledAt),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 30,
      mode: mode ? String(mode) : "Online",
      locationOrLink: locationOrLink ? String(locationOrLink) : null,
      notes: notes ? String(notes) : null,
      status: "scheduled",
    }).returning();

    res.status(201).json(interview);
  } catch (err) {
    req.log.error({ err }, "schedule interview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Candidate Search (Discoverable students only)
router.get("/recruiter/candidates/search", requireRecruiter, async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const candidates = await db.select().from(usersTable)
      .where(and(eq(usersTable.role, "student"), eq(usersTable.isDiscoverable, true)));

    const filtered = candidates.filter(c => {
      if (!q) return true;
      const term = q.toLowerCase();
      const nameMatch = c.displayName.toLowerCase().includes(term);
      const emailMatch = c.email.toLowerCase().includes(term);
      const collegeMatch = c.college?.toLowerCase().includes(term) ?? false;
      const skillsMatch = c.skills?.some(s => s.toLowerCase().includes(term)) ?? false;
      return nameMatch || emailMatch || collegeMatch || skillsMatch;
    });

    res.json(filtered.map(s => ({
      id: s.id, displayName: s.displayName, email: s.email,
      college: s.college, degree: s.degree, branch: s.branch,
      skills: s.skills ?? [], location: s.location, photoUrl: s.photoUrl,
      linkedinUrl: s.linkedinUrl, githubUrl: s.githubUrl, portfolioUrl: s.portfolioUrl,
    })));
  } catch (err) {
    req.log.error({ err }, "candidate search error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Talent Pools
router.get("/recruiter/pools", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const pools = await db.select().from(talentPoolsTable).where(eq(talentPoolsTable.recruiterId, recruiter.id));
    res.json(pools);
  } catch (err) {
    req.log.error({ err }, "get talent pools error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recruiter/pools", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const { name, description } = req.body ?? {};
    if (!name) { res.status(400).json({ error: "Pool name is required" }); return; }

    const [pool] = await db.insert(talentPoolsTable).values({
      recruiterId: recruiter.id,
      name: String(name),
      description: description ? String(description) : null,
    }).returning();
    res.status(201).json(pool);
  } catch (err) {
    req.log.error({ err }, "create talent pool error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
