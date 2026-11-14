
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * Supported notification types
 */
export const NOTIFICATION_TYPES = [
  "application_status",
  "system",
  "interview",
] as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[number];

/**
 * MongoDB Notification document
 */
export interface NotificationItem {
  _id?: ObjectId;

  studentId: ObjectId;

  notificationType: NotificationType;

  title: string;
  message: string;

  relatedId?: ObjectId | null;

  read: boolean;

  createdAt: Date;
}

/**
 * Validation schema
 */
export const insertNotificationSchema = z.object({
  studentId: z.instanceof(ObjectId),

  notificationType: z.enum(NOTIFICATION_TYPES),

  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),

  relatedId: z.instanceof(ObjectId).nullable().optional(),

  read: z.boolean().default(false),

  createdAt: z.coerce.date().optional(),
});

export type InsertNotification = z.infer<
  typeof insertNotificationSchema
>;
