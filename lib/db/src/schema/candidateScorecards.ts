import { ObjectId } from "mongodb";
import { z } from "zod";

export interface CandidateScorecard {
  _id?: ObjectId;
  id?: number;
  applicationId: number | string | ObjectId;
  recruiterId: number | string | ObjectId;
  technicalSkills: number;
  communication: number;
  problemSolving: number;
  cultureFit: number;
  overallRating: number;
  feedback?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const insertCandidateScorecardSchema = z.object({
  applicationId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  recruiterId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  technicalSkills: z.number().min(0).max(5).default(0),
  communication: z.number().min(0).max(5).default(0),
  problemSolving: z.number().min(0).max(5).default(0),
  cultureFit: z.number().min(0).max(5).default(0),
  overallRating: z.number().min(0).max(5).default(0),
  feedback: z.string().nullable().optional(),
});

export type InsertCandidateScorecard = z.infer<typeof insertCandidateScorecardSchema>;
