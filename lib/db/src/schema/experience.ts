
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * MongoDB Student Experience document
 */
export interface StudentExperience {
  _id?: ObjectId;

  studentId: ObjectId;

  organization: string;
  role: string;
  description: string;

  startDate: string;
  endDate?: string | null;

  current: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validation schema
 */
export const insertStudentExperienceSchema = z.object({
  studentId: z.instanceof(ObjectId),

  organization: z.string().min(1, "Organization is required"),
  role: z.string().min(1, "Role is required"),
  description: z.string().min(1, "Description is required"),

  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().nullable().optional(),

  current: z.boolean().default(false),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type InsertStudentExperience = z.infer<
  typeof insertStudentExperienceSchema
>;
