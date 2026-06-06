import { Router } from "express";
import { db, jobsTable, applicationsTable, usersTable, certificatesTable } from "@workspace/db";
import { eq, ilike, or, sql, and, inArray, desc } from "drizzle-orm";
import { CreateJobBody, ListJobsQueryParams, ApplyToJobParams } from "@workspace/api-zod";
import { requireAuth, requireStudent, requireRecruiter } from "../middlewares/requireAuth";

const router = Router();

function serializeJob(j: any) {
  return {
    id: j.id,
    title: j.title,
    description: j.description,
    company: j.company,
    location: j.location,
    jobType: j.jobType,
    salary: j.salary,
    skills: j.skills ?? [],
    recruiterId: j.recruiterId,
    postedAt: j.postedAt instanceof Date ? j.postedAt.toISOString() : j.postedAt,
    isActive: j.isActive,
    applicantCount: j.applicantCount,
  };
}

router.get("/jobs", async (req, res) => {
  try {
    const query = ListJobsQueryParams.safeParse(req.query);
    const { search, skills: skillsParam, jobType } = query.success ? query.data : {};

    let conditions: any[] = [eq(jobsTable.isActive, true)];

    if (search) {
      conditions.push(
        or(
          ilike(jobsTable.title, `%${search}%`),
          ilike(jobsTable.company, `%${search}%`),
          ilike(jobsTable.description, `%${search}%`),
        )
      );
    }
    if (jobType) {
      conditions.push(eq(jobsTable.jobType, jobType));
    }

    const jobs = await db.select().from(jobsTable).where(and(...conditions)).orderBy(desc(jobsTable.postedAt)).limit(50);
    res.json(jobs.map(serializeJob));
  } catch (err) {
    req.log.error({ err }, "list jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/filters", async (req, res) => {
  try {
    const jobs = await db.select({ skills: jobsTable.skills, jobType: jobsTable.jobType }).from(jobsTable).where(eq(jobsTable.isActive, true));
    const allSkills = new Set<string>();
    const allJobTypes = new Set<string>();
    for (const j of jobs) {
      (j.skills ?? []).forEach(s => allSkills.add(s));
      if (j.jobType) allJobTypes.add(j.jobType);
    }
    res.json({ skills: Array.from(allSkills), jobTypes: Array.from(allJobTypes) });
  } catch (err) {
    req.log.error({ err }, "get filters error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/jobs/my-applications", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const apps = await db.select().from(applicationsTable).where(eq(applicationsTable.studentId, user.id)).orderBy(desc(applicationsTable.appliedAt));
    const jobIds = apps.map(a => a.jobId);
    const jobsMap = new Map<number, any>();
    if (jobIds.length > 0) {
      const jobList = await db.select().from(jobsTable).where(inArray(jobsTable.id, jobIds));
      for (const j of jobList) jobsMap.set(j.id, serializeJob(j));
    }
    res.json(apps.map(a => ({
      id: a.id,
      jobId: a.jobId,
      studentId: a.studentId,
      status: a.status,
      appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
      job: jobsMap.get(a.jobId) ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "my applications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs/:jobId/apply", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const jobId = parseInt(req.params.jobId as string);
    if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job ID" }); return; }

    const existing = await db.select().from(applicationsTable).where(
      and(eq(applicationsTable.jobId, jobId), eq(applicationsTable.studentId, user.id))
    ).limit(1);
    if (existing[0]) { res.status(400).json({ error: "Already applied" }); return; }

    const [app] = await db.insert(applicationsTable).values({
      jobId,
      studentId: user.id,
      status: "pending",
    }).returning();

    await db.update(jobsTable).set({ applicantCount: sql`${jobsTable.applicantCount} + 1` as any }).where(eq(jobsTable.id, jobId));

    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
    res.json({
      id: app.id,
      jobId: app.jobId,
      studentId: app.studentId,
      status: app.status,
      appliedAt: app.appliedAt instanceof Date ? app.appliedAt.toISOString() : app.appliedAt,
      job: job ? serializeJob(job) : null,
    });
  } catch (err) {
    req.log.error({ err }, "apply to job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/jobs", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

    const { title, description, company, location, jobType, salary, skills } = parsed.data;
    const [job] = await db.insert(jobsTable).values({
      title,
      description,
      company,
      location,
      jobType,
      salary: salary ?? null,
      skills: skills ?? [],
      recruiterId: user.id,
      isActive: true,
      applicantCount: 0,
    }).returning();

    res.status(201).json(serializeJob(job));
  } catch (err) {
    req.log.error({ err }, "create job error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
