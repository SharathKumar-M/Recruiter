import { Router } from "express";
import {
  getUsersCollection,
  getJobsCollection,
  getApplicationsCollection,
  getCertificatesCollection,
  getDocumentsCollection,
  getRecruiterNotesCollection,
  getCandidateScorecardsCollection,
  getInterviewsCollection,
  getTalentPoolsCollection,
  getNextSequence,
  toIdFilter,
  downloadFromGridFS,
} from "@workspace/db";
import { UpdateRecruiterProfileBody, UpdateApplicationStatusBody } from "@workspace/api-zod";
import { requireRecruiter } from "../middlewares/requireAuth";
import { getStudentIdConditions } from "../lib/studentDocuments";

const router = Router();

function serializeJob(j: any) {
  return {
    id: j.id ?? j._id?.toString(),
    title: j.title,
    description: j.description,
    company: j.company,
    location: j.location,
    jobType: j.jobType,
    salary: j.salary,
    skills: j.skills ?? [],
    recruiterId: j.recruiterId?.toString(),
    postedAt: j.postedAt instanceof Date ? j.postedAt.toISOString() : j.postedAt,
    isActive: j.isActive,
    applicantCount: j.applicantCount ?? 0,
  };
}

function getRecruiterIdConditions(user: any): any[] {
  const conditions: any[] = [];
  if (user.id !== undefined) conditions.push({ recruiterId: user.id });
  if (user._id) {
    conditions.push({ recruiterId: user._id });
    conditions.push({ recruiterId: user._id.toString() });
  }
  return conditions;
}

router.get("/recruiter/profile", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    res.json({
      id: user.id ?? user._id?.toString(),
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      photoUrl: user.photoUrl,
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
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.companyName !== undefined) updates.companyName = parsed.data.companyName;

    const usersCol = await getUsersCollection();
    const updated = await usersCol.findOneAndUpdate(
      toIdFilter(user.id ?? user._id),
      { $set: updates },
      { returnDocument: "after" }
    );

    const result = updated ?? { ...user, ...updates };
    res.json({
      id: result.id ?? result._id?.toString(),
      displayName: result.displayName,
      email: result.email,
      role: result.role,
      companyName: result.companyName,
      photoUrl: result.photoUrl,
      createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : result.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "update recruiter profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/jobs", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const jobsCol = await getJobsCollection();
    const jobs = await jobsCol
      .find({ $or: getRecruiterIdConditions(user) })
      .sort({ postedAt: -1 })
      .toArray();

    res.json(jobs.map(serializeJob));
  } catch (err) {
    req.log.error({ err }, "recruiter jobs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/applications", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const [jobsCol, applicationsCol, usersCol, certificatesCol, documentsCol] = await Promise.all([
      getJobsCollection(),
      getApplicationsCollection(),
      getUsersCollection(),
      getCertificatesCollection(),
      getDocumentsCollection(),
    ]);

    const myJobs = await jobsCol.find({ $or: getRecruiterIdConditions(user) }).toArray();
    if (myJobs.length === 0) {
      res.json([]);
      return;
    }

    const jobConditions: any[] = [];
    const jobMap = new Map<string, any>();
    for (const j of myJobs) {
      const serialized = serializeJob(j);
      if (j._id) {
        jobConditions.push({ jobId: j._id });
        jobConditions.push({ jobId: j._id.toString() });
        jobMap.set(j._id.toString(), serialized);
      }
      if (j.id !== undefined) {
        jobConditions.push({ jobId: j.id });
        jobConditions.push({ jobId: String(j.id) });
        jobMap.set(String(j.id), serialized);
      }
    }

    const apps = await applicationsCol
      .find({ $or: jobConditions })
      .sort({ appliedAt: -1 })
      .toArray();

    const studentIds = [...new Set(apps.map((a) => a.studentId))];
    const studentFilters = studentIds.map((id) => toIdFilter(id));

    const students = studentFilters.length > 0
      ? await usersCol.find({ $or: studentFilters }).toArray()
      : [];

    const studentMap = new Map<string, any>();
    for (const s of students) {
      if (s._id) studentMap.set(s._id.toString(), s);
      if (s.id !== undefined) studentMap.set(String(s.id), s);
    }

    const docFilters = studentIds.map((id) => ({
      $or: [{ studentId: id }, ...(typeof id === "string" ? [{ studentId: id }] : [])],
    }));

    const resumeMap = new Map<string, any>();
    if (docFilters.length > 0) {
      const docs = await documentsCol.find({ $or: docFilters }).sort({ uploadedAt: -1 }).toArray();
      for (const d of docs) {
        const key = String(d.studentId);
        if (d.documentType === "resume" && !resumeMap.has(key)) {
          resumeMap.set(key, d);
        }
      }
    }

    const certFilters = studentIds.map((id) => ({
      $or: [{ studentId: id }, ...(typeof id === "string" ? [{ studentId: id }] : [])],
    }));

    const certMap = new Map<string, any[]>();
    if (certFilters.length > 0) {
      const certs = await certificatesCol.find({ $or: certFilters }).toArray();
      for (const c of certs) {
        const key = String(c.studentId);
        const arr = certMap.get(key) ?? [];
        arr.push({
          id: c.id ?? c._id?.toString(),
          filename: c.filename,
          url: c.url,
          uploadedAt: c.uploadedAt instanceof Date ? c.uploadedAt.toISOString() : c.uploadedAt,
        });
        certMap.set(key, arr);
      }
    }

    const allApps = await applicationsCol.find({}, { projection: { studentId: 1, jobId: 1 } }).toArray();
    const appliedMap = new Map<string, any[]>();
    for (const a of allApps) {
      const key = String(a.studentId);
      const arr = appliedMap.get(key) ?? [];
      arr.push(a.jobId);
      appliedMap.set(key, arr);
    }

    res.json(
      apps.map((a) => {
        const s = studentMap.get(String(a.studentId));
        const j = jobMap.get(String(a.jobId));
        const studentKey = s ? String(s.id ?? s._id) : String(a.studentId);
        const resumeDoc = resumeMap.get(studentKey);
        const effectiveResumeUrl = resumeDoc
          ? `/api/recruiter/documents/${resumeDoc.id ?? resumeDoc._id}/file`
          : s?.resumeUrl || null;
        const effectiveResumeFilename = resumeDoc?.filename || resumeDoc?.originalFilename || s?.resumeFilename || null;

        return {
          id: a.id ?? a._id?.toString(),
          jobId: a.jobId?.toString(),
          studentId: a.studentId?.toString(),
          status: a.status,
          appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
          student: s
            ? {
                id: s.id ?? s._id?.toString(),
                displayName: s.displayName,
                email: s.email,
                role: s.role,
                college: s.college,
                skills: s.skills ?? [],
                linkedinUrl: s.linkedinUrl,
                githubUrl: s.githubUrl,
                portfolioUrl: s.portfolioUrl,
                resumeUrl: effectiveResumeUrl,
                resumeFilename: effectiveResumeFilename,
                photoUrl: s.photoUrl,
                appliedJobIds: appliedMap.get(studentKey) ?? [],
                certificates: certMap.get(studentKey) ?? [],
                createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
              }
            : null,
          job: j ?? null,
        };
      })
    );
  } catch (err) {
    req.log.error({ err }, "recruiter applications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/stats", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const [jobsCol, applicationsCol, usersCol] = await Promise.all([
      getJobsCollection(),
      getApplicationsCollection(),
      getUsersCollection(),
    ]);

    const myJobs = await jobsCol.find({ $or: getRecruiterIdConditions(user) }).toArray();
    if (myJobs.length === 0) {
      res.json({
        totalJobs: 0,
        totalApplications: 0,
        pendingApplications: 0,
        shortlistedApplications: 0,
        recentApplications: [],
      });
      return;
    }

    const jobConditions: any[] = [];
    const jobMap = new Map<string, any>();
    for (const j of myJobs) {
      const serialized = serializeJob(j);
      if (j._id) {
        jobConditions.push({ jobId: j._id });
        jobConditions.push({ jobId: j._id.toString() });
        jobMap.set(j._id.toString(), serialized);
      }
      if (j.id !== undefined) {
        jobConditions.push({ jobId: j.id });
        jobConditions.push({ jobId: String(j.id) });
        jobMap.set(String(j.id), serialized);
      }
    }

    const apps = await applicationsCol
      .find({ $or: jobConditions })
      .sort({ appliedAt: -1 })
      .toArray();

    const pending = apps.filter((a) => a.status === "pending").length;
    const shortlisted = apps.filter((a) => a.status === "shortlisted").length;

    const recentApps = apps.slice(0, 5);
    const recentStudentIds = [...new Set(recentApps.map((a) => a.studentId))];
    const studentFilters = recentStudentIds.map((id) => toIdFilter(id));

    const recentStudents = studentFilters.length > 0
      ? await usersCol.find({ $or: studentFilters }).toArray()
      : [];

    const studentMap = new Map<string, any>();
    for (const s of recentStudents) {
      if (s._id) studentMap.set(s._id.toString(), s);
      if (s.id !== undefined) studentMap.set(String(s.id), s);
    }

    const recentApplications = recentApps.map((a) => {
      const s = studentMap.get(String(a.studentId));
      const j = jobMap.get(String(a.jobId));
      return {
        id: a.id ?? a._id?.toString(),
        jobId: a.jobId?.toString(),
        studentId: a.studentId?.toString(),
        status: a.status,
        appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
        student: s
          ? {
              id: s.id ?? s._id?.toString(),
              displayName: s.displayName,
              email: s.email,
              role: s.role,
              college: s.college,
              skills: s.skills ?? [],
              linkedinUrl: s.linkedinUrl,
              githubUrl: s.githubUrl,
              portfolioUrl: s.portfolioUrl,
              resumeUrl: s.resumeUrl,
              resumeFilename: s.resumeFilename,
              photoUrl: s.photoUrl,
              appliedJobIds: [],
              certificates: [],
              createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
            }
          : null,
        job: j ?? null,
      };
    });

    res.json({
      totalJobs: myJobs.length,
      totalApplications: apps.length,
      pendingApplications: pending,
      shortlistedApplications: shortlisted,
      recentApplications,
    });
  } catch (err) {
    req.log.error({ err }, "recruiter stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/recruiter/student/:studentId", requireRecruiter, async (req, res) => {
  try {
    const studentParam = req.params.studentId as string;
    const [usersCol, applicationsCol, certificatesCol] = await Promise.all([
      getUsersCollection(),
      getApplicationsCollection(),
      getCertificatesCollection(),
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

    const [apps, certs] = await Promise.all([
      applicationsCol.find({ $or: studentIdConditions }).toArray(),
      certificatesCol.find({ $or: studentIdConditions }).toArray(),
    ]);

    res.json({
      id: student.id ?? student._id?.toString(),
      displayName: student.displayName,
      email: student.email,
      role: student.role,
      college: student.college,
      skills: student.skills ?? [],
      linkedinUrl: student.linkedinUrl,
      githubUrl: student.githubUrl,
      portfolioUrl: student.portfolioUrl,
      resumeUrl: student.resumeUrl,
      resumeFilename: student.resumeFilename,
      photoUrl: student.photoUrl,
      appliedJobIds: apps.map((a: any) => a.jobId),
      certificates: certs.map((c: any) => ({
        id: c.id ?? c._id?.toString(),
        filename: c.filename,
        url: c.url,
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
    const appId = req.params.applicationId as string;
    const parsed = UpdateApplicationStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }

    const [applicationsCol, jobsCol] = await Promise.all([
      getApplicationsCollection(),
      getJobsCollection(),
    ]);

    const updated = await applicationsCol.findOneAndUpdate(
      toIdFilter(appId),
      { $set: { status: parsed.data.status } },
      { returnDocument: "after" }
    );

    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const job = await jobsCol.findOne(toIdFilter(updated.jobId));

    res.json({
      id: updated.id ?? updated._id?.toString(),
      jobId: updated.jobId?.toString(),
      studentId: updated.studentId?.toString(),
      status: updated.status,
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
    const appId = req.params.applicationId as string;
    const col = await getRecruiterNotesCollection();
    const notes = await col.find(toIdFilter(appId)).toArray();
    res.json(
      notes.map((n) => ({
        id: n.id ?? n._id?.toString(),
        applicationId: n.applicationId,
        recruiterId: n.recruiterId,
        note: n.note,
        tags: n.tags ?? [],
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "get notes error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recruiter/applications/:applicationId/notes", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const appId = req.params.applicationId as string;
    const { note, tags } = req.body ?? {};
    if (!note) {
      res.status(400).json({ error: "Note content is required" });
      return;
    }

    const col = await getRecruiterNotesCollection();
    const seqId = await getNextSequence("recruiterNotes");
    const now = new Date();

    const newNote = {
      id: seqId,
      applicationId: Number.isInteger(Number(appId)) ? Number(appId) : appId,
      recruiterId: recruiter.id ?? recruiter._id,
      note: String(note),
      tags: Array.isArray(tags) ? tags.map(String) : [],
      createdAt: now,
    };

    const result = await col.insertOne(newNote);
    res.status(201).json({
      ...newNote,
      _id: result.insertedId,
      createdAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "create note error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/recruiter/notes/:noteId", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const noteId = req.params.noteId as string;
    const col = await getRecruiterNotesCollection();

    const recruiterIdConditions: any[] = [];
    if (recruiter.id !== undefined) recruiterIdConditions.push({ recruiterId: recruiter.id });
    if (recruiter._id) {
      recruiterIdConditions.push({ recruiterId: recruiter._id });
      recruiterIdConditions.push({ recruiterId: recruiter._id.toString() });
    }

    const result = await col.deleteOne({
      $and: [toIdFilter(noteId), { $or: recruiterIdConditions }],
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "delete note error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Scorecards
router.get("/recruiter/applications/:applicationId/scorecard", requireRecruiter, async (req, res) => {
  try {
    const appId = req.params.applicationId as string;
    const col = await getCandidateScorecardsCollection();
    const scorecard = await col.findOne({
      $or: [
        { applicationId: Number(appId) },
        { applicationId: appId },
      ],
    });
    res.json(scorecard || null);
  } catch (err) {
    req.log.error({ err }, "get scorecard error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/recruiter/applications/:applicationId/scorecard", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const appId = req.params.applicationId as string;
    const { technicalSkills, communication, problemSolving, cultureFit, overallRating, feedback } = req.body ?? {};

    const col = await getCandidateScorecardsCollection();
    const query = {
      $or: [
        { applicationId: Number(appId) },
        { applicationId: appId },
      ],
    };

    const existing = await col.findOne(query);

    if (existing) {
      const updates = {
        technicalSkills: technicalSkills !== undefined ? Number(technicalSkills) : existing.technicalSkills,
        communication: communication !== undefined ? Number(communication) : existing.communication,
        problemSolving: problemSolving !== undefined ? Number(problemSolving) : existing.problemSolving,
        cultureFit: cultureFit !== undefined ? Number(cultureFit) : existing.cultureFit,
        overallRating: overallRating !== undefined ? Number(overallRating) : existing.overallRating,
        feedback: feedback !== undefined ? String(feedback) : existing.feedback,
        updatedAt: new Date(),
      };

      const updated = await col.findOneAndUpdate(query, { $set: updates }, { returnDocument: "after" });
      res.json(updated);
    } else {
      const seqId = await getNextSequence("candidateScorecards");
      const newScorecard = {
        id: seqId,
        applicationId: Number.isInteger(Number(appId)) ? Number(appId) : appId,
        recruiterId: recruiter.id ?? recruiter._id,
        technicalSkills: Number(technicalSkills ?? 0),
        communication: Number(communication ?? 0),
        problemSolving: Number(problemSolving ?? 0),
        cultureFit: Number(cultureFit ?? 0),
        overallRating: Number(overallRating ?? 0),
        feedback: feedback ? String(feedback) : null,
        createdAt: new Date(),
      };

      await col.insertOne(newScorecard);
      res.status(201).json(newScorecard);
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
    const col = await getInterviewsCollection();
    const list = await col
      .find({ $or: getRecruiterIdConditions(recruiter) })
      .sort({ scheduledAt: -1 })
      .toArray();

    res.json(
      list.map((i) => ({
        id: i.id ?? i._id?.toString(),
        applicationId: i.applicationId,
        recruiterId: i.recruiterId,
        studentId: i.studentId,
        scheduledAt: i.scheduledAt,
        durationMinutes: i.durationMinutes,
        mode: i.mode,
        locationOrLink: i.locationOrLink,
        notes: i.notes,
        status: i.status,
      }))
    );
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

    const col = await getInterviewsCollection();
    const seqId = await getNextSequence("interviews");

    const newInterview = {
      id: seqId,
      applicationId: Number(applicationId) || applicationId,
      recruiterId: recruiter.id ?? recruiter._id,
      studentId: Number(studentId) || studentId,
      scheduledAt: String(scheduledAt),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 30,
      mode: mode ? String(mode) : "Online",
      locationOrLink: locationOrLink ? String(locationOrLink) : null,
      notes: notes ? String(notes) : null,
      status: "scheduled",
      createdAt: new Date(),
    };

    const result = await col.insertOne(newInterview);
    res.status(201).json({
      ...newInterview,
      _id: result.insertedId,
    });
  } catch (err) {
    req.log.error({ err }, "schedule interview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Candidate Search (Discoverable students only)
router.get("/recruiter/candidates/search", requireRecruiter, async (req, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();
    const usersCol = await getUsersCollection();

    const filter: any = { role: "student", isDiscoverable: true };

    if (q) {
      const regex = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$or = [
        { displayName: regex },
        { email: regex },
        { college: regex },
        { skills: regex },
      ];
    }

    const candidates = await usersCol.find(filter).toArray();

    res.json(
      candidates.map((s) => ({
        id: s.id ?? s._id?.toString(),
        displayName: s.displayName,
        email: s.email,
        college: s.college,
        degree: s.degree,
        branch: s.branch,
        skills: s.skills ?? [],
        location: s.location,
        photoUrl: s.photoUrl,
        linkedinUrl: s.linkedinUrl,
        githubUrl: s.githubUrl,
        portfolioUrl: s.portfolioUrl,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "candidate search error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Talent Pools
router.get("/recruiter/pools", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const col = await getTalentPoolsCollection();
    const pools = await col.find({ $or: getRecruiterIdConditions(recruiter) }).toArray();
    res.json(
      pools.map((p) => ({
        id: p.id ?? p._id?.toString(),
        recruiterId: p.recruiterId,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "get talent pools error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/recruiter/pools", requireRecruiter, async (req, res) => {
  try {
    const recruiter = (req as any).dbUser;
    const { name, description } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "Pool name is required" });
      return;
    }

    const col = await getTalentPoolsCollection();
    const seqId = await getNextSequence("talentPools");
    const now = new Date();

    const newPool = {
      id: seqId,
      recruiterId: recruiter.id ?? recruiter._id,
      name: String(name),
      description: description ? String(description) : null,
      createdAt: now,
    };

    const result = await col.insertOne(newPool);
    res.status(201).json({
      ...newPool,
      _id: result.insertedId,
      createdAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "create talent pool error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Authenticated applicant document view for recruiter
router.get("/recruiter/documents/:id/file", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const docId = req.params.id as string;
    const [documentsCol, jobsCol, applicationsCol] = await Promise.all([
      getDocumentsCollection(),
      getJobsCollection(),
      getApplicationsCollection(),
    ]);

    const doc = await documentsCol.findOne(toIdFilter(docId));
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Verify recruiter has at least one application from this student
    const myJobs = await jobsCol.find({ $or: getRecruiterIdConditions(user) }).toArray();
    const myJobIds = myJobs.map((j) => j.id ?? j._id);
    const myJobIdStrings = myJobs.map((j) => String(j.id ?? j._id));
    const allJobIds = [...myJobIds, ...myJobIdStrings];

    const hasApplicant = await applicationsCol.findOne({
      $and: [
        { jobId: { $in: allJobIds } },
        { $or: getStudentIdConditions(doc.studentId) },
      ],
    });

    if (!hasApplicant) {
      res.status(403).json({ error: "Unauthorized: Candidate has not applied to any of your posted jobs." });
      return;
    }

    if (doc.gridfsId) {
      const fileData = await downloadFromGridFS(doc.gridfsId);
      if (fileData) {
        res.setHeader("Content-Type", doc.mimeType || fileData.contentType);
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${encodeURIComponent(doc.filename || fileData.filename)}"`
        );
        res.setHeader("Content-Length", fileData.length);
        res.setHeader("Cache-Control", "private, max-age=3600");
        fileData.stream.pipe(res);
        return;
      }
    }

    if (doc.url && (doc.url.startsWith("http://") || doc.url.startsWith("https://"))) {
      res.redirect(doc.url);
      return;
    }

    res.status(404).json({ error: "Document content is not available in storage" });
  } catch (err) {
    req.log.error({ err }, "download applicant document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
