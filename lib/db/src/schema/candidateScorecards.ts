import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candidateScorecardsTable = pgTable("candidate_scorecards", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  recruiterId: integer("recruiter_id").notNull(),
  technicalSkills: integer("technical_skills").notNull().default(0),
  communication: integer("communication").notNull().default(0),
  problemSolving: integer("problem_solving").notNull().default(0),
  cultureFit: integer("culture_fit").notNull().default(0),
  overallRating: integer("overall_rating").notNull().default(0),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCandidateScorecardSchema = createInsertSchema(candidateScorecardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCandidateScorecard = z.infer<typeof insertCandidateScorecardSchema>;
export type CandidateScorecard = typeof candidateScorecardsTable.$inferSelect;
