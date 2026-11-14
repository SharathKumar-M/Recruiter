
import { ObjectId } from "mongodb";
import { z } from "zod";

/**
 * MongoDB Certificate document
 */
export interface Certificate {
  _id?: ObjectId;

  studentId: ObjectId;

  title?: string | null;
  issuingOrganization?: string | null;
  issueDate?: string | null;
  documentReference?: string | null;

  filename: string;
  url: string;

  uploadedAt: Date;
}

/**
 * Validation schema for creating a certificate
 */
export const insertCertificateSchema = z.object({
  studentId: z.instanceof(ObjectId),

  title: z.string().nullable().optional(),
  issuingOrganization: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  documentReference: z.string().nullable().optional(),

  filename: z.string().min(1, "Filename is required"),
  url: z.string().min(1, "Certificate URL is required"),

  uploadedAt: z.coerce.date().optional(),
});

export type InsertCertificate = z.infer<
  typeof insertCertificateSchema
>;
