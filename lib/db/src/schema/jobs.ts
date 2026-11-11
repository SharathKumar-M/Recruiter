
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * Job types
 */
export const JOB_TYPES = ["Remote", "Hybrid", "On-site"] as const;

export type JobType = (typeof JOB_TYPES)[number];

/**
 * MongoDB Job document
 */
export interface Job {
  _id?: ObjectId;

  title: string;
  description: string;
  company: string;
  location: string;
  jobType: JobType;

  salary?: string | null;
  skills: string[];

  // MongoDB ObjectId of the recruiter in the users collection
  recruiterId: ObjectId;

  isActive: boolean;
  applicantCount: number;

  postedAt: Date;
}

/**
 * Validation schema for creating a job
 */
export const insertJobSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  description: z.string().min(1, "Job description is required"),
  company: z.string().min(1, "Company name is required"),
  location: z.string().min(1, "Location is required"),

  jobType: z.enum(JOB_TYPES),

  salary: z.string().nullable().optional(),

  skills: z.array(z.string()).default([]),

  recruiterId: z.instanceof(ObjectId),

  isActive: z.boolean().default(true),
  applicantCount: z.number().int().min(0).default(0),

  postedAt: z.coerce.date().optional(),
});

export type InsertJob = z.infer<typeof insertJobSchema>;
