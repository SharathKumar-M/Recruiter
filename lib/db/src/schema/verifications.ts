
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * Verification verdicts
 */
export const VERIFICATION_VERDICTS = [
  "AUTHENTIC",
  "LIKELY_AUTHENTIC",
  "SUSPICIOUS",
  "FAKE",
] as const;

export type VerificationVerdict =
  (typeof VERIFICATION_VERDICTS)[number];

/**
 * JSON result structures
 * Keep these flexible because the analysis output may evolve.
 */
export type VerificationCheck = Record<string, unknown>;

/**
 * MongoDB Verification document
 */
export interface Verification {
  _id?: ObjectId;

  studentId: ObjectId;
  recruiterId: ObjectId;

  trustScore: number;
  verdict: VerificationVerdict;
  summary: string;

  strengths: string[];
  redFlags: string[];

  educationCheck: VerificationCheck;
  experienceCheck: VerificationCheck;
  githubCheck: VerificationCheck;
  certificatesCheck: VerificationCheck;

  recommendation: string;

  analyzedAt: Date;
}

/**
 * Validation schema for creating a verification
 */
export const insertVerificationSchema = z.object({
  studentId: z.instanceof(ObjectId),
  recruiterId: z.instanceof(ObjectId),

  trustScore: z.number().int().min(0).max(100),

  verdict: z.enum(VERIFICATION_VERDICTS),

  summary: z.string().min(1),

  strengths: z.array(z.string()).default([]),
  redFlags: z.array(z.string()).default([]),

  educationCheck: z.record(z.string(), z.unknown()),
  experienceCheck: z.record(z.string(), z.unknown()),
  githubCheck: z.record(z.string(), z.unknown()),
  certificatesCheck: z.record(z.string(), z.unknown()),

  recommendation: z.string().min(1),

  analyzedAt: z.coerce.date().optional(),
});

export type InsertVerification = z.infer<
  typeof insertVerificationSchema
>;
