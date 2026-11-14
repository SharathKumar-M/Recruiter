
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * MongoDB Student Project document
 */
export interface StudentProject {
  _id?: ObjectId;

  studentId: ObjectId;

  title: string;
  description: string;

  technologies: string[];

  githubUrl?: string | null;
  liveUrl?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validation schema
 */
export const insertStudentProjectSchema = z.object({
  studentId: z.instanceof(ObjectId),

  title: z.string().min(1, "Project title is required"),
  description: z.string().min(1, "Project description is required"),

  technologies: z.array(z.string()).default([]),

  githubUrl: z.string().nullable().optional(),
  liveUrl: z.string().nullable().optional(),

  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type InsertStudentProject = z.infer<
  typeof insertStudentProjectSchema
>;
