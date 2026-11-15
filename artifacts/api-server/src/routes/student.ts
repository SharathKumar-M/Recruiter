import { Router } from "express";
import {
  getUsersCollection,
  getJobsCollection,
  getApplicationsCollection,
  getCertificatesCollection,
  getVerificationsCollection,
  getStudentProjectsCollection,
  getStudentExperienceCollection,
  getDocumentsCollection,
  getNotificationsCollection,
  getNextSequence,
  toIdFilter,
  uploadToGridFS,
  downloadFromGridFS,
  deleteFromGridFS,
} from "@workspace/db";
import { UpdateStudentProfileBody } from "@workspace/api-zod";
import { requireStudent } from "../middlewares/requireAuth";
import { parseMultipartFormData } from "../lib/multipartParser";
import { extractTextFromFile } from "../lib/textExtractor";
import { getStudentIdConditions, getStudentDocuments, getStudentResume } from "../lib/studentDocuments";

const router = Router();

function serializeStudent(user: any, appliedJobIds: any[], certificates: any[], documents: any[]) {
  const resumeDoc = documents.find((d) => d.documentType === "resume");
  return {
    id: user.id ?? user._id?.toString(),
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    college: user.college,
    degree: user.degree,
    branch: user.branch,
    location: user.location,
    graduationYear: user.graduationYear,
    professionalSummary: user.professionalSummary,
    skills: user.skills ?? [],
    programmingLanguages: user.programmingLanguages ?? [],
    frameworks: user.frameworks ?? [],
    databases: user.databases ?? [],
    tools: user.tools ?? [],
    otherSkills: user.otherSkills ?? [],
    linkedinUrl: user.linkedinUrl,
    githubUrl: user.githubUrl,
    portfolioUrl: user.portfolioUrl,
    resumeUrl: resumeDoc?.url || user.resumeUrl || null,
    resumeFilename: resumeDoc?.filename || resumeDoc?.originalFilename || user.resumeFilename || null,
    photoUrl: user.photoUrl,
    appliedJobIds,
    certificates: certificates.map((c) => ({
      id: c.id ?? c._id?.toString(),
      title: c.title,
      issuingOrganization: c.issuingOrganization,
      issueDate: c.issueDate,
      documentReference: c.documentReference,
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
    const [applicationsCol, certificatesCol, documentsCol] = await Promise.all([
      getApplicationsCollection(),
      getCertificatesCollection(),
      getDocumentsCollection(),
    ]);

    const studentFilter = { $or: getStudentIdConditions(user) };

    const [apps, certs, docs] = await Promise.all([
      applicationsCol.find(studentFilter).toArray(),
      certificatesCol.find(studentFilter).toArray(),
      documentsCol.find(studentFilter).toArray(),
    ]);

    const appliedJobIds = apps.map((a) => a.jobId);
    res.json(serializeStudent(user, appliedJobIds, certs, docs));
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
    if ((data as any).degree !== undefined) updates.degree = (data as any).degree;
    if ((data as any).branch !== undefined) updates.branch = (data as any).branch;
    if ((data as any).photoUrl !== undefined) updates.photoUrl = (data as any).photoUrl;
    if ((data as any).programmingLanguages !== undefined) updates.programmingLanguages = (data as any).programmingLanguages;
    if ((data as any).frameworks !== undefined) updates.frameworks = (data as any).frameworks;
    if ((data as any).databases !== undefined) updates.databases = (data as any).databases;
    if ((data as any).tools !== undefined) updates.tools = (data as any).tools;
    if ((data as any).otherSkills !== undefined) updates.otherSkills = (data as any).otherSkills;

    // Aggregate skills if categorized arrays are provided
    const pl = updates.programmingLanguages ?? user.programmingLanguages ?? [];
    const fw = updates.frameworks ?? user.frameworks ?? [];
    const dbList = updates.databases ?? user.databases ?? [];
    const toolsList = updates.tools ?? user.tools ?? [];
    const other = updates.otherSkills ?? user.otherSkills ?? [];
    const combinedSkills = Array.from(new Set([...pl, ...fw, ...dbList, ...toolsList, ...other]));
    if (combinedSkills.length > 0) {
      updates.skills = combinedSkills;
    }
    updates.updatedAt = new Date();

    const usersCol = await getUsersCollection();
    const updated = await usersCol.findOneAndUpdate(
      toIdFilter(user.id ?? user._id),
      { $set: updates },
      { returnDocument: "after" }
    );

    const currentUser = updated ?? { ...user, ...updates };

    const [applicationsCol, certificatesCol, documentsCol] = await Promise.all([
      getApplicationsCollection(),
      getCertificatesCollection(),
      getDocumentsCollection(),
    ]);

    const studentFilter = { $or: getStudentIdConditions(user) };

    const [apps, certs, docs] = await Promise.all([
      applicationsCol.find(studentFilter).toArray(),
      certificatesCol.find(studentFilter).toArray(),
      documentsCol.find(studentFilter).toArray(),
    ]);

    res.json(serializeStudent(currentUser, apps.map((a) => a.jobId), certs, docs));
  } catch (err) {
    req.log.error({ err }, "update student profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/student/stats", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const [applicationsCol, jobsCol] = await Promise.all([
      getApplicationsCollection(),
      getJobsCollection(),
    ]);

    const apps = await applicationsCol
      .find({ $or: getStudentIdConditions(user) })
      .sort({ appliedAt: -1 })
      .toArray();

    const total = apps.length;
    const pending = apps.filter((a) => a.status === "pending").length;
    const shortlisted = apps.filter((a) => a.status === "shortlisted").length;

    let completion = 0;
    if (user.displayName) completion += 15;
    if (user.photoUrl) completion += 10;
    if (user.professionalSummary && user.professionalSummary.length >= 10) completion += 10;
    if (user.location) completion += 5;
    if (user.college && user.degree) completion += 20;
    if (user.skills && user.skills.length > 0) completion += 20;
    if (user.githubUrl || user.linkedinUrl) completion += 10;
    if (user.resumeUrl) completion += 10;
    completion = Math.min(100, completion);

    const recentApps = apps.slice(0, 5);
    const recentJobIds = recentApps.map((a) => a.jobId);

    const jobsMap = new Map<string, any>();
    if (recentJobIds.length > 0) {
      const jobFilters = recentJobIds.map((id) => toIdFilter(id));
      const recentJobs = await jobsCol.find({ $or: jobFilters }).toArray();
      for (const j of recentJobs) {
        const item = {
          id: j.id ?? j._id?.toString(),
          title: j.title,
          company: j.company,
          location: j.location,
          jobType: j.jobType,
          salary: j.salary,
          skills: j.skills ?? [],
          recruiterId: j.recruiterId?.toString(),
          postedAt: j.postedAt instanceof Date ? j.postedAt.toISOString() : j.postedAt,
          isActive: j.isActive,
          applicantCount: j.applicantCount,
          description: j.description,
        };
        if (j._id) jobsMap.set(j._id.toString(), item);
        if (j.id !== undefined) jobsMap.set(String(j.id), item);
      }
    }

    const recentApplications = recentApps.map((a) => ({
      id: a.id ?? a._id?.toString(),
      jobId: a.jobId?.toString(),
      studentId: a.studentId?.toString(),
      status: a.status,
      appliedAt: a.appliedAt instanceof Date ? a.appliedAt.toISOString() : a.appliedAt,
      job: jobsMap.get(String(a.jobId)) ?? null,
    }));

    res.json({
      totalApplications: total,
      pendingApplications: pending,
      shortlistedApplications: shortlisted,
      profileCompletion: completion,
      recentApplications,
    });
  } catch (err) {
    req.log.error({ err }, "student stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Projects CRUD for student
router.get("/student/projects", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const col = await getStudentProjectsCollection();
    const projects = await col.find({ $or: getStudentIdConditions(user) }).toArray();
    res.json(
      projects.map((p) => ({
        id: p.id ?? p._id?.toString(),
        studentId: p.studentId,
        title: p.title,
        description: p.description,
        technologies: p.technologies ?? [],
        githubUrl: p.githubUrl,
        liveUrl: p.liveUrl,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      }))
    );
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

    const col = await getStudentProjectsCollection();
    const seqId = await getNextSequence("studentProjects");
    const now = new Date();

    const newProject = {
      id: seqId,
      studentId: user.id ?? user._id,
      title: String(title),
      description: String(description),
      technologies: Array.isArray(technologies) ? technologies.map(String) : [],
      githubUrl: githubUrl ? String(githubUrl) : null,
      liveUrl: liveUrl ? String(liveUrl) : null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(newProject);
    res.status(201).json({
      ...newProject,
      _id: result.insertedId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "create student project error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/projects/:id", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = req.params.id as string;
    const col = await getStudentProjectsCollection();

    const result = await col.deleteOne({
      $and: [toIdFilter(projectId), { $or: getStudentIdConditions(user) }],
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
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
    const col = await getStudentExperienceCollection();
    const experience = await col.find({ $or: getStudentIdConditions(user) }).toArray();
    res.json(
      experience.map((e) => ({
        id: e.id ?? e._id?.toString(),
        studentId: e.studentId,
        organization: e.organization,
        role: e.role,
        description: e.description,
        startDate: e.startDate,
        endDate: e.endDate,
        current: Boolean(e.current),
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
      }))
    );
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

    const col = await getStudentExperienceCollection();
    const seqId = await getNextSequence("studentExperience");
    const now = new Date();

    const newExp = {
      id: seqId,
      studentId: user.id ?? user._id,
      organization: String(organization),
      role: String(role),
      description: String(description),
      startDate: String(startDate),
      endDate: endDate ? String(endDate) : null,
      current: Boolean(current),
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(newExp);
    res.status(201).json({
      ...newExp,
      _id: result.insertedId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "create student experience error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/experience/:id", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const expId = req.params.id as string;
    const col = await getStudentExperienceCollection();

    const result = await col.deleteOne({
      $and: [toIdFilter(expId), { $or: getStudentIdConditions(user) }],
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Experience not found" });
      return;
    }
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
    const docs = await getStudentDocuments(user);
    res.json(
      docs.map((d: any) => ({
        id: d.id ?? d._id?.toString(),
        studentId: d.studentId,
        documentType: d.documentType,
        filename: d.filename,
        originalFilename: d.originalFilename || d.filename,
        mimeType: d.mimeType || "application/octet-stream",
        fileSize: d.fileSize || 0,
        hasExtractedText: Boolean(d.extractedText && d.extractedText.trim().length > 0),
        url: d.gridfsId ? `/api/student/documents/${d.id ?? d._id}/file` : d.url,
        metadata: d.metadata,
        uploadedAt: d.uploadedAt instanceof Date ? d.uploadedAt.toISOString() : d.uploadedAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "get student documents error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/student/documents", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const contentType = req.headers["content-type"] || "";
    const isMultipart = contentType.includes("multipart/form-data");

    const col = await getDocumentsCollection();
    const usersCol = await getUsersCollection();
    const seqId = await getNextSequence("documents");
    const now = new Date();

    if (isMultipart) {
      const parsed = await parseMultipartFormData(req);
      const file = parsed.file;
      const documentType = (parsed.fields.documentType || "resume").toLowerCase().trim() as any;
      const customFilename = parsed.fields.filename?.trim();

      if (!file) {
        res.status(400).json({ error: "No file was attached to the upload request" });
        return;
      }

      // Store file in GridFS
      const gridfsId = await uploadToGridFS(
        customFilename || file.originalFilename,
        file.buffer,
        file.mimeType,
        {
          studentId: user.id ?? user._id,
          documentType,
          originalFilename: file.originalFilename,
        }
      );

      // Extract text content from PDF, DOCX, TXT
      const extraction = await extractTextFromFile(
        file.originalFilename,
        file.buffer,
        file.mimeType
      );

      const fileUrl = `/api/student/documents/${seqId}/file`;
      const docItem = {
        id: seqId,
        studentId: user.id ?? user._id,
        documentType,
        filename: customFilename || file.originalFilename,
        originalFilename: file.originalFilename,
        mimeType: file.mimeType,
        fileSize: file.size,
        gridfsId,
        extractedText: extraction.success ? extraction.text : null,
        extractedTextLength: extraction.charCount,
        extractionError: extraction.success ? null : extraction.reason,
        url: fileUrl,
        metadata: null,
        uploadedAt: now,
        updatedAt: now,
      };

      const result = await col.insertOne(docItem);

      // If document is resume, update user profile resume fields
      if (documentType === "resume") {
        await usersCol.updateOne(
          toIdFilter(user.id ?? user._id),
          {
            $set: {
              resumeUrl: fileUrl,
              resumeFilename: docItem.filename,
              updatedAt: now,
            },
          }
        );
      }

      res.status(201).json({
        ...docItem,
        _id: result.insertedId,
        hasExtractedText: extraction.success,
        uploadedAt: now.toISOString(),
      });
      return;
    }

    // JSON fallback for backwards compatibility
    const { documentType, filename, url, metadata } = req.body ?? {};
    if (!documentType || !filename || !url) {
      res.status(400).json({ error: "Document type, filename, and URL are required" });
      return;
    }

    const newDoc = {
      id: seqId,
      studentId: user.id ?? user._id,
      documentType: String(documentType),
      filename: String(filename),
      originalFilename: String(filename),
      mimeType: "application/octet-stream",
      fileSize: 0,
      gridfsId: null,
      extractedText: null,
      extractedTextLength: 0,
      extractionError: null,
      url: String(url),
      metadata: metadata ? String(metadata) : null,
      uploadedAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(newDoc);

    if (newDoc.documentType === "resume") {
      await usersCol.updateOne(
        toIdFilter(user.id ?? user._id),
        {
          $set: {
            resumeUrl: newDoc.url,
            resumeFilename: newDoc.filename,
            updatedAt: now,
          },
        }
      );
    }

    res.status(201).json({
      ...newDoc,
      _id: result.insertedId,
      uploadedAt: now.toISOString(),
    });
  } catch (err: any) {
    req.log.error({ err }, "upload document error");
    res.status(500).json({ error: "Failed to upload document", details: err.message || String(err) });
  }
});

// Authenticated document file download/view
router.get("/student/documents/:id/file", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const docId = req.params.id as string;
    const col = await getDocumentsCollection();

    const doc = await col.findOne({
      $and: [toIdFilter(docId), { $or: getStudentIdConditions(user) }],
    });

    if (!doc) {
      res.status(404).json({ error: "Document not found or access denied" });
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

    // If external URL
    if (doc.url && (doc.url.startsWith("http://") || doc.url.startsWith("https://"))) {
      res.redirect(doc.url);
      return;
    }

    res.status(404).json({ error: "Document content is not available in storage" });
  } catch (err) {
    req.log.error({ err }, "download student document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/student/documents/:id", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const docId = req.params.id as string;
    const col = await getDocumentsCollection();
    const usersCol = await getUsersCollection();

    const doc = await col.findOne({
      $and: [toIdFilter(docId), { $or: getStudentIdConditions(user) }],
    });

    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Delete stored file from GridFS
    if (doc.gridfsId) {
      await deleteFromGridFS(doc.gridfsId);
    }

    await col.deleteOne({ _id: doc._id });

    // Clear user resume fields if deleting the active resume
    if (doc.documentType === "resume") {
      const remainingResume = await col.findOne(
        { $and: [{ documentType: "resume" }, { $or: getStudentIdConditions(user) }] },
        { sort: { uploadedAt: -1 } }
      );

      if (remainingResume) {
        await usersCol.updateOne(
          toIdFilter(user.id ?? user._id),
          {
            $set: {
              resumeUrl: remainingResume.url,
              resumeFilename: remainingResume.filename,
              updatedAt: new Date(),
            },
          }
        );
      } else {
        await usersCol.updateOne(
          toIdFilter(user.id ?? user._id),
          {
            $set: {
              resumeUrl: null,
              resumeFilename: null,
              updatedAt: new Date(),
            },
          }
        );
      }
    }

    res.json({ success: true, message: "Document deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "delete document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Notifications for student
router.get("/student/notifications", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const col = await getNotificationsCollection();
    const notifs = await col
      .find({ $or: getStudentIdConditions(user) })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      notifs.map((n) => ({
        id: n.id ?? n._id?.toString(),
        studentId: n.studentId,
        notificationType: n.notificationType,
        title: n.title,
        message: n.message,
        relatedId: n.relatedId,
        read: Boolean(n.read),
        createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "get notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/student/notifications/:id/read", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const notifId = req.params.id as string;
    const col = await getNotificationsCollection();

    const updated = await col.findOneAndUpdate(
      { $and: [toIdFilter(notifId), { $or: getStudentIdConditions(user) }] },
      { $set: { read: true } },
      { returnDocument: "after" }
    );

    if (!updated) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({
      id: updated.id ?? updated._id?.toString(),
      studentId: updated.studentId,
      notificationType: updated.notificationType,
      title: updated.title,
      message: updated.message,
      read: true,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "mark notification read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

router.get("/student/ai-result", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const col = await getVerificationsCollection();
    const result = await col.findOne(
      { $or: getStudentIdConditions(user) },
      { sort: { analyzedAt: -1 } }
    );

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
