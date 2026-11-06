import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const talentPoolsTable = pgTable("talent_pools", {
  id: serial("id").primaryKey(),
  recruiterId: integer("recruiter_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTalentPoolSchema = createInsertSchema(talentPoolsTable).omit({ id: true, createdAt: true });
export type InsertTalentPool = z.infer<typeof insertTalentPoolSchema>;
export type TalentPool = typeof talentPoolsTable.$inferSelect;

export const talentPoolMembersTable = pgTable("talent_pool_members", {
  id: serial("id").primaryKey(),
  poolId: integer("pool_id").notNull(),
  studentId: integer("student_id").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTalentPoolMemberSchema = createInsertSchema(talentPoolMembersTable).omit({ id: true, addedAt: true });
export type InsertTalentPoolMember = z.infer<typeof insertTalentPoolMemberSchema>;
export type TalentPoolMember = typeof talentPoolMembersTable.$inferSelect;
