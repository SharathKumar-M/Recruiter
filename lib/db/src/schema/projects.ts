import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentProjectsTable = pgTable("student_projects", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  technologies: text("technologies").array().notNull().default([]),
  githubUrl: text("github_url"),
  liveUrl: text("live_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentProjectSchema = createInsertSchema(studentProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentProject = z.infer<typeof insertStudentProjectSchema>;
export type StudentProject = typeof studentProjectsTable.$inferSelect;
