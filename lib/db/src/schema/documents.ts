
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * Supported document types
 */
export const DOCUMENT_TYPES = [
  "resume",
  "certificate",
  "transcript",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * MongoDB Document
 */
export interface DocumentItem {
  _id?: ObjectId;

  studentId: ObjectId;

  documentType: DocumentType;

  filename: string;
  url: string;

  metadata?: string | null;

  uploadedAt: Date;
}

/**
 * Validation schema
 */
export const insertDocumentSchema = z.object({
  studentId: z.instanceof(ObjectId),

  documentType: z.enum(DOCUMENT_TYPES),

  filename: z.string().min(1, "Filename is required"),
  url: z.string().min(1, "Document URL is required"),

  metadata: z.string().nullable().optional(),

  uploadedAt: z.coerce.date().optional(),
});

export type InsertDocument = z.infer<
  typeof insertDocumentSchema
>;
