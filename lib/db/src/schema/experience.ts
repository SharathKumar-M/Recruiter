import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentExperienceTable = pgTable("student_experience", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  organization: text("organization").notNull(),
  role: text("role").notNull(),
  description: text("description").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  current: boolean("current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentExperienceSchema = createInsertSchema(studentExperienceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentExperience = z.infer<typeof insertStudentExperienceSchema>;
export type StudentExperience = typeof studentExperienceTable.$inferSelect;
