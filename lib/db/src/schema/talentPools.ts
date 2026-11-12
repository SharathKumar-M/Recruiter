import { ObjectId } from "mongodb";
import { z } from "zod";

export interface TalentPool {
  _id?: ObjectId;
  id?: number;
  recruiterId: number | string | ObjectId;
  name: string;
  description?: string | null;
  createdAt: Date;
}

export const insertTalentPoolSchema = z.object({
  recruiterId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  name: z.string().min(1, "Pool name is required"),
  description: z.string().nullable().optional(),
});

export type InsertTalentPool = z.infer<typeof insertTalentPoolSchema>;

export interface TalentPoolMember {
  _id?: ObjectId;
  id?: number;
  poolId: number | string | ObjectId;
  studentId: number | string | ObjectId;
  addedAt: Date;
}

export const insertTalentPoolMemberSchema = z.object({
  poolId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  studentId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
});

export type InsertTalentPoolMember = z.infer<typeof insertTalentPoolMemberSchema>;
