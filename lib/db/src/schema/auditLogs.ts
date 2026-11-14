import { ObjectId } from "mongodb";
import { z } from "zod";

export interface AuditLog {
  _id?: ObjectId;
  id?: number;
  recruiterId: number | string | ObjectId;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  details?: string | null;
  createdAt: Date;
}

export const insertAuditLogSchema = z.object({
  recruiterId: z.union([z.number(), z.string(), z.instanceof(ObjectId)]),
  action: z.string().min(1, "Action is required"),
  resourceType: z.string().min(1, "Resource type is required"),
  resourceId: z.union([z.number(), z.string()]).nullable().optional(),
  details: z.string().nullable().optional(),
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
