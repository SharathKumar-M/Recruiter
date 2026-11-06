import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recruiterNotesTable = pgTable("recruiter_notes", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  recruiterId: integer("recruiter_id").notNull(),
  note: text("note").notNull(),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRecruiterNoteSchema = createInsertSchema(recruiterNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRecruiterNote = z.infer<typeof insertRecruiterNoteSchema>;
export type RecruiterNote = typeof recruiterNotesTable.$inferSelect;
