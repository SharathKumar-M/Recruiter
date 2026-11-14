import { ObjectId } from "mongodb";
import { z } from "zod";

export interface Interview {
  _id?: ObjectId;
  id?: number;
  applicationId: number | string | ObjectId;
  recruiterId: number | string | ObjectId;
  studentId: number | string | ObjectId;
  scheduledAt: string;
  durationMinutes: number;
  mode: string;
  locationOrLink?: string | null;
  notes?: string | null;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export const insertInterviewSchema = z.object({
  applicationId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  recruiterId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  studentId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  scheduledAt: z.string().min(1, "Scheduled time is required"),
  durationMinutes: z.number().default(30),
  mode: z.string().default("Online"),
  locationOrLink: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
});

export type InsertInterview = z.infer<typeof insertInterviewSchema>;
