
import { Router } from "express";
import { ObjectId, type Document } from "mongodb";
import { getDB, toIdFilter, getNextSequence } from "@workspace/db";
import {
  CreateJobBody,
  ListJobsQueryParams,
} from "@workspace/api-zod";
import {
  requireStudent,
  requireRecruiter,
} from "../middlewares/requireAuth";

const router = Router();

/**
 * MongoDB document types
 */
interface JobDocument extends Document {
  _id?: ObjectId;
  id?: number;
  title: string;
  description: string;
  company: string;
  location: string;
  jobType: string;
  salary?: string | null;
  skills: string[];
  recruiterId: ObjectId;
  isActive: boolean;
  applicantCount: number;
  postedAt: Date;
}

interface ApplicationDocument extends Document {
  _id?: ObjectId;
  id?: number;
  jobId: ObjectId | number;
  studentId: ObjectId | number;
  status: string;
  appliedAt: Date;
}

/**
 * Serialize MongoDB job into API response.
 */
function serializeJob(job: JobDocument) {
  return {
    id: job.id ?? job._id?.toString(),
    title: job.title,
    description: job.description,
    company: job.company,
    location: job.location,
    jobType: job.jobType,
    salary: job.salary ?? null,
    skills: job.skills ?? [],
    recruiterId: job.recruiterId?.toString(),
    postedAt: job.postedAt instanceof Date
      ? job.postedAt.toISOString()
      : job.postedAt,
    isActive: job.isActive,
    applicantCount: job.applicantCount ?? 0,
  };
}

/**
 * Escape user input before using it in a regular expression.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/jobs
 * List active jobs with optional search and filters.
 */
router.get("/jobs", async (req, res) => {
  try {
    const query = ListJobsQueryParams.safeParse(req.query);

    if (!query.success) {
      res.status(400).json({
        error: "Invalid job filters",
      });
      return;
    }

    const {
      search,
      skills: skillsParam,
      jobType,
    } = query.data;

    const database = await getDB();
    const jobsCollection =
      database.collection<JobDocument>("jobs");

    const filter: Document = {
      isActive: true,
    };

    if (search) {
      const searchRegex = {
        $regex: escapeRegex(search),
        $options: "i",
      };

      filter.$or = [
        { title: searchRegex },
        { company: searchRegex },
        { description: searchRegex },
      ];
    }

    if (jobType) {
      filter.jobType = jobType;
    }

    if (skillsParam) {
      const requestedSkills = Array.isArray(skillsParam)
        ? skillsParam
        : String(skillsParam).split(",").map((s) => s.trim());

      const cleanedSkills = requestedSkills.filter(Boolean);

      if (cleanedSkills.length > 0) {
        filter.skills = {
          $in: cleanedSkills,
        };
      }
    }

    const jobs = await jobsCollection
      .find(filter)
      .sort({ postedAt: -1 })
      .limit(50)
      .toArray();

    res.json(jobs.map(serializeJob));
  } catch (error) {
    req.log.error({ err: error }, "list jobs error");

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/jobs/filters
 * Return available skills and job types.
 */
router.get("/jobs/filters", async (req, res) => {
  try {
    const database = await getDB();
    const jobsCollection =
      database.collection<JobDocument>("jobs");

    const [skills, jobTypes] = await Promise.all([
      jobsCollection.distinct("skills", {
        isActive: true,
      }),
      jobsCollection.distinct("jobType", {
        isActive: true,
      }),
    ]);

    res.json({
      skills: skills.filter(
        (skill): skill is string => typeof skill === "string"
      ),
      jobTypes: jobTypes.filter(
        (type): type is string => typeof type === "string"
      ),
    });
  } catch (error) {
    req.log.error({ err: error }, "get filters error");

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/jobs/my-applications
 * Return applications belonging to the logged-in student.
 */
router.get("/jobs/my-applications", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;

    if (!user?._id || !ObjectId.isValid(user._id.toString())) {
      res.status(401).json({
        error: "Invalid student account",
      });
      return;
    }

    const database = await getDB();

    const applicationsCollection =
      database.collection<ApplicationDocument>("applications");

    const jobsCollection =
      database.collection<JobDocument>("jobs");

    const studentFilter: Document = {
      $or: [
        ...(user.id !== undefined ? [{ studentId: user.id }] : []),
        ...(ObjectId.isValid(String(user._id)) ? [{ studentId: new ObjectId(user._id) }] : []),
        { studentId: String(user._id) },
      ],
    };

    const applications = await applicationsCollection
      .find(studentFilter)
      .sort({ appliedAt: -1 })
      .toArray();

    const jobIds = applications.map((application) => application.jobId);

    const objectIdJobIds = jobIds
      .filter((id) => id instanceof ObjectId || (typeof id === "string" && ObjectId.isValid(id) && id.length === 24))
      .map((id) => (id instanceof ObjectId ? id : new ObjectId(id)));

    const numberJobIds = jobIds
      .filter((id) => typeof id === "number" || (!Number.isNaN(Number(id)) && Number.isInteger(Number(id))))
      .map((id) => Number(id));

    const orConditions: Document[] = [];
    if (objectIdJobIds.length > 0) {
      orConditions.push({ _id: { $in: objectIdJobIds } });
    }
    if (numberJobIds.length > 0) {
      orConditions.push({ id: { $in: numberJobIds } });
    }

    const jobs = orConditions.length > 0
      ? await jobsCollection
          .find({ $or: orConditions })
          .toArray()
      : [];

    const jobsMap = new Map<string, any>();
    for (const job of jobs) {
      const serialized = serializeJob(job);
      if (job._id) jobsMap.set(job._id.toString(), serialized);
      if (job.id !== undefined) jobsMap.set(String(job.id), serialized);
    }

    res.json(
      applications.map((application) => ({
        id: application.id ?? application._id?.toString(),
        jobId: application.jobId.toString(),
        studentId: application.studentId.toString(),
        status: application.status,
        appliedAt: application.appliedAt instanceof Date
          ? application.appliedAt.toISOString()
          : application.appliedAt,
        job: jobsMap.get(String(application.jobId)) ?? null,
      }))
    );
  } catch (error) {
    req.log.error({ err: error }, "my applications error");

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/jobs/:jobId/apply
 * Apply for an active job.
 */
router.post("/jobs/:jobId/apply", requireStudent, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const jobIdParam = req.params.jobId;

    if (!user?._id) {
      res.status(401).json({
        error: "Invalid student account",
      });
      return;
    }

    const database = await getDB();

    const jobsCollection =
      database.collection<JobDocument>("jobs");

    const applicationsCollection =
      database.collection<ApplicationDocument>("applications");

    const job = await jobsCollection.findOne({
      ...toIdFilter(jobIdParam),
      isActive: true,
    });

    if (!job) {
      res.status(404).json({
        error: "Job not found or inactive",
      });
      return;
    }

    const jobId = job._id!;
    const studentId = ObjectId.isValid(String(user._id)) ? new ObjectId(user._id) : user._id;

    const existing = await applicationsCollection.findOne({
      $and: [
        { $or: [{ jobId: job._id }, ...(job.id !== undefined ? [{ jobId: job.id }] : [])] },
        { $or: [{ studentId }, ...(user.id !== undefined ? [{ studentId: user.id }] : []), { studentId: String(user._id) }] },
      ],
    });

    if (existing) {
      res.status(400).json({
        error: "Already applied",
      });
      return;
    }

    const seqId = await getNextSequence("applications");
    const application: ApplicationDocument = {
      id: seqId,
      jobId,
      studentId: studentId as any,
      status: "pending",
      appliedAt: new Date(),
    };

    let insertedId: ObjectId;

    try {
      const result = await applicationsCollection.insertOne(
        application
      );

      insertedId = result.insertedId;
    } catch (error: any) {
      if (error?.code === 11000) {
        res.status(400).json({
          error: "Already applied",
        });
        return;
      }

      throw error;
    }

    await jobsCollection.updateOne(
      { _id: jobId },
      { $inc: { applicantCount: 1 } }
    );

    const updatedJob = await jobsCollection.findOne({
      _id: jobId,
    });

    res.status(201).json({
      id: seqId,
      jobId: job.id ?? jobId.toString(),
      studentId: user.id ?? studentId.toString(),
      status: "pending",
      appliedAt: application.appliedAt.toISOString(),
      job: updatedJob ? serializeJob(updatedJob) : null,
    });
  } catch (error) {
    req.log.error({ err: error }, "apply to job error");

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/jobs
 * Create a job. Recruiters only.
 */
router.post("/jobs", requireRecruiter, async (req, res) => {
  try {
    const user = (req as any).dbUser;

    if (!user?._id) {
      res.status(401).json({
        error: "Invalid recruiter account",
      });
      return;
    }

    const parsed = CreateJobBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid body",
        details: parsed.error.flatten(),
      });
      return;
    }

    const {
      title,
      description,
      company,
      location,
      jobType,
      salary,
      skills,
    } = parsed.data;

    const database = await getDB();

    const jobsCollection =
      database.collection<JobDocument>("jobs");

    const seqId = await getNextSequence("jobs");
    const job: JobDocument = {
      id: seqId,
      title,
      description,
      company,
      location,
      jobType,
      salary: salary ?? null,
      skills: skills ?? [],
      recruiterId: ObjectId.isValid(String(user._id)) ? new ObjectId(user._id) : user._id,
      isActive: true,
      applicantCount: 0,
      postedAt: new Date(),
    };

    const result = await jobsCollection.insertOne(job);

    const createdJob = await jobsCollection.findOne({
      _id: result.insertedId,
    });

    if (!createdJob) {
      res.status(500).json({
        error: "Job was created but could not be retrieved",
      });
      return;
    }

    res.status(201).json(serializeJob(createdJob));
  } catch (error) {
    req.log.error({ err: error }, "create job error");

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
