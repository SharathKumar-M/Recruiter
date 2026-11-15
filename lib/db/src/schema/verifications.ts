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
  "UNVERIFIED",
] as const;

export type VerificationVerdict = (typeof VERIFICATION_VERDICTS)[number];

/**
 * JSON result structures
 * Flexible because analysis checks contain domain-specific metrics.
 */
export type VerificationCheck = Record<string, unknown>;

/**
 * MongoDB Verification document
 */
export interface Verification {
  _id?: ObjectId;
  id?: number;

  studentId: ObjectId | number | string;
  recruiterId: ObjectId | number | string;

  trustScore: number;
  verdict: VerificationVerdict;
  summary: string;
  executiveSummary?: string;

  strengths: string[];
  verifiedStrengths?: string[];
  missingInformation?: string[];
  redFlags: string[];

  educationCheck: VerificationCheck;
  experienceCheck: VerificationCheck;
  githubCheck: VerificationCheck;
  certificatesCheck: VerificationCheck;
  resumeAssessment?: VerificationCheck;

  evidenceSources?: string[];
  limitations?: string[];

  recommendation: string;

  analysisProvider?: string;
  analysisMode?: string;

  analyzedAt: Date;
}

/**
 * Validation schema for creating a verification
 */
export const insertVerificationSchema = z.object({
  studentId: z.union([z.instanceof(ObjectId), z.number(), z.string()]),
  recruiterId: z.union([z.instanceof(ObjectId), z.number(), z.string()]),

  trustScore: z.number().int().min(0).max(100),

  verdict: z.enum(VERIFICATION_VERDICTS),

  summary: z.string().min(1),
  executiveSummary: z.string().optional(),

  strengths: z.array(z.string()).default([]),
  verifiedStrengths: z.array(z.string()).optional(),
  missingInformation: z.array(z.string()).optional(),
  redFlags: z.array(z.string()).default([]),

  educationCheck: z.record(z.string(), z.unknown()),
  experienceCheck: z.record(z.string(), z.unknown()),
  githubCheck: z.record(z.string(), z.unknown()),
  certificatesCheck: z.record(z.string(), z.unknown()),
  resumeAssessment: z.record(z.string(), z.unknown()).optional(),

  evidenceSources: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),

  recommendation: z.string().min(1),

  analysisProvider: z.string().optional(),
  analysisMode: z.string().optional(),

  analyzedAt: z.coerce.date().optional(),
});

export type InsertVerification = z.infer<typeof insertVerificationSchema>;
