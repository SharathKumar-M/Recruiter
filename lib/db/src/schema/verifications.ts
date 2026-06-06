import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const verificationsTable = pgTable("verifications", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  recruiterId: integer("recruiter_id").notNull(),
  trustScore: integer("trust_score").notNull(),
  verdict: text("verdict").notNull(), // AUTHENTIC | LIKELY_AUTHENTIC | SUSPICIOUS | FAKE
  summary: text("summary").notNull(),
  strengths: text("strengths").array().notNull().default([]),
  redFlags: text("red_flags").array().notNull().default([]),
  educationCheck: jsonb("education_check").notNull(),
  experienceCheck: jsonb("experience_check").notNull(),
  githubCheck: jsonb("github_check").notNull(),
  certificatesCheck: jsonb("certificates_check").notNull(),
  recommendation: text("recommendation").notNull(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVerificationSchema = createInsertSchema(verificationsTable).omit({ id: true, analyzedAt: true });
export type InsertVerification = z.infer<typeof insertVerificationSchema>;
export type Verification = typeof verificationsTable.$inferSelect;
