
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * Application statuses
 */
export const APPLICATION_STATUSES = [
  "pending",
  "reviewed",
  "shortlisted",
  "rejected",
] as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUSES)[number];

/**
 * MongoDB Application document
 */
export interface Application {
  _id?: ObjectId;

  jobId: ObjectId;
  studentId: ObjectId;

  status: ApplicationStatus;

  appliedAt: Date;
}

/**
 * Validation schema for creating an application
 */
export const insertApplicationSchema = z.object({
  jobId: z.instanceof(ObjectId),
  studentId: z.instanceof(ObjectId),

  status: z.enum(APPLICATION_STATUSES).default("pending"),

  appliedAt: z.coerce.date().optional(),
});

export type InsertApplication = z.infer<
  typeof insertApplicationSchema
>;
