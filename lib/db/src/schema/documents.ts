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
 * MongoDB Document Item
 */
export interface DocumentItem {
  _id?: ObjectId;
  id?: number;

  studentId: ObjectId | number | string;

  documentType: DocumentType;

  filename: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;

  gridfsId?: ObjectId | string | null;

  extractedText?: string | null;
  extractedTextLength?: number;
  extractionError?: string | null;

  url: string;

  metadata?: string | null;

  uploadedAt: Date;
  updatedAt?: Date;
}

/**
 * Validation schema for documents
 */
export const insertDocumentSchema = z.object({
  studentId: z.union([z.instanceof(ObjectId), z.number(), z.string()]),

  documentType: z.enum(DOCUMENT_TYPES),

  filename: z.string().min(1, "Filename is required"),
  originalFilename: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),

  gridfsId: z.union([z.instanceof(ObjectId), z.string()]).nullable().optional(),

  extractedText: z.string().nullable().optional(),
  extractedTextLength: z.number().optional(),
  extractionError: z.string().nullable().optional(),

  url: z.string().min(1, "Document URL is required"),

  metadata: z.string().nullable().optional(),

  uploadedAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
