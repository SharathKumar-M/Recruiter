
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * User roles
 */
export const USER_ROLES = ["student", "recruiter"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * MongoDB User document
 */
export interface User {
  _id?: ObjectId;

  clerkId: string;
  email: string;
  role: UserRole;

  displayName: string;
  companyName?: string | null;
  photoUrl?: string | null;

  college?: string | null;
  degree?: string | null;
  branch?: string | null;
  location?: string | null;
  graduationYear?: string | null;
  professionalSummary?: string | null;

  skills: string[];
  programmingLanguages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  otherSkills: string[];

  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;

  resumeUrl?: string | null;
  resumeFilename?: string | null;

  isDiscoverable: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod validation for creating a user
 */
export const insertUserSchema = z.object({
  clerkId: z.string().min(1),
  email: z.string().email(),

  role: z.enum(USER_ROLES).default("student"),

  displayName: z.string().min(1),

  companyName: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),

  college: z.string().nullable().optional(),
  degree: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  graduationYear: z.string().nullable().optional(),
  professionalSummary: z.string().nullable().optional(),

  skills: z.array(z.string()).default([]),
  programmingLanguages: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  otherSkills: z.array(z.string()).default([]),

  linkedinUrl: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  portfolioUrl: z.string().nullable().optional(),

  resumeUrl: z.string().nullable().optional(),
  resumeFilename: z.string().nullable().optional(),

  isDiscoverable: z.boolean().default(false),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
