import { ObjectId } from "mongodb";
import { z } from "zod";

export interface RecruiterNote {
  _id?: ObjectId;
  id?: number;
  applicationId: number | string | ObjectId;
  recruiterId: number | string | ObjectId;
  note: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const insertRecruiterNoteSchema = z.object({
  applicationId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  recruiterId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  note: z.string().min(1, "Note is required"),
  tags: z.array(z.string()).default([]),
});

export type InsertRecruiterNote = z.infer<typeof insertRecruiterNoteSchema>;
