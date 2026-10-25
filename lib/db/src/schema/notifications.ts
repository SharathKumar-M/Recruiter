import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  notificationType: text("notification_type").notNull(), // "application_status" | "system" | "interview"
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationItem = typeof notificationsTable.$inferSelect;
