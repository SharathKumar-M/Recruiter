import {
  getUsersCollection,
  getDocumentsCollection,
  getCertificatesCollection,
  getStudentProjectsCollection,
  getStudentExperienceCollection,
  getApplicationsCollection,
  getGridFSBuffer,
  toIdFilter,
  toObjectId,
} from "@workspace/db";
import type { DocumentItem } from "@workspace/db/schema";
import { extractTextFromFile } from "./textExtractor";

export function getStudentIdConditions(userOrId: any): any[] {
  const conditions: any[] = [];
  if (!userOrId) return conditions;

  if (typeof userOrId === "object") {
    if (userOrId.id !== undefined) conditions.push({ studentId: userOrId.id });
    if (userOrId._id) {
      conditions.push({ studentId: userOrId._id });
      conditions.push({ studentId: userOrId._id.toString() });
    }
    if (userOrId.clerkId) conditions.push({ studentId: userOrId.clerkId });
  } else {
    conditions.push({ studentId: userOrId });
    const num = Number(userOrId);
    if (!Number.isNaN(num) && Number.isInteger(num)) {
      conditions.push({ studentId: num });
    }
    const objId = toObjectId(userOrId);
    if (objId) {
      conditions.push({ studentId: objId });
    }
    conditions.push({ studentId: String(userOrId) });
  }

  return conditions;
}

export async function getStudentDocuments(userOrId: any): Promise<DocumentItem[]> {
  const col = await getDocumentsCollection();
  const conditions = getStudentIdConditions(userOrId);
  if (conditions.length === 0) return [];

  const docs = await col
    .find({ $or: conditions })
    .sort({ uploadedAt: -1 })
    .toArray();

  return docs as DocumentItem[];
}

export interface StudentResumeResult {
  document: DocumentItem | null;
  text: string | null;
  filename: string | null;
  url: string | null;
  extracted: boolean;
  reason?: string;
}

export async function getStudentResume(userOrId: any): Promise<StudentResumeResult> {
  const docs = await getStudentDocuments(userOrId);
  const resumeDoc = docs.find((d) => d.documentType === "resume");

  if (resumeDoc) {
    // If text was already extracted and cached
    if (resumeDoc.extractedText && resumeDoc.extractedText.trim().length > 0) {
      return {
        document: resumeDoc,
        text: resumeDoc.extractedText,
        filename: resumeDoc.filename || resumeDoc.originalFilename || "Resume",
        url: resumeDoc.url,
        extracted: true,
      };
    }

    // If gridfsId exists, retrieve buffer and extract on-the-fly
    if (resumeDoc.gridfsId) {
      try {
        const buffer = await getGridFSBuffer(resumeDoc.gridfsId);
        if (buffer) {
          const extraction = await extractTextFromFile(
            resumeDoc.filename || "resume.pdf",
            buffer,
            resumeDoc.mimeType
          );

          if (extraction.success && extraction.text) {
            // Update document cache in background
            const col = await getDocumentsCollection();
            await col.updateOne(
              { _id: resumeDoc._id },
              {
                $set: {
                  extractedText: extraction.text,
                  extractedTextLength: extraction.charCount,
                  extractionError: null,
                  updatedAt: new Date(),
                },
              }
            );

            return {
              document: resumeDoc,
              text: extraction.text,
              filename: resumeDoc.filename || resumeDoc.originalFilename || "Resume",
              url: resumeDoc.url,
              extracted: true,
            };
          } else {
            return {
              document: resumeDoc,
              text: null,
              filename: resumeDoc.filename || resumeDoc.originalFilename || "Resume",
              url: resumeDoc.url,
              extracted: false,
              reason: extraction.reason || "No extractable text layers in resume file.",
            };
          }
        }
      } catch (err: any) {
        return {
          document: resumeDoc,
          text: null,
          filename: resumeDoc.filename || resumeDoc.originalFilename || "Resume",
          url: resumeDoc.url,
          extracted: false,
          reason: `Failed to read file from GridFS: ${err.message || String(err)}`,
        };
      }
    }

    return {
      document: resumeDoc,
      text: null,
      filename: resumeDoc.filename || resumeDoc.originalFilename || "Resume",
      url: resumeDoc.url,
      extracted: false,
      reason: resumeDoc.extractionError || "File content has not been processed.",
    };
  }

  // Fallback to user profile legacy fields
  let user = typeof userOrId === "object" && userOrId !== null ? userOrId : null;
  if (!user) {
    const usersCol = await getUsersCollection();
    user = await usersCol.findOne(toIdFilter(userOrId));
  }

  if (user?.resumeUrl) {
    return {
      document: null,
      text: null,
      filename: user.resumeFilename || "Resume",
      url: user.resumeUrl,
      extracted: false,
      reason: "Legacy resume URL present on profile, but no file uploaded to document store.",
    };
  }

  return {
    document: null,
    text: null,
    filename: null,
    url: null,
    extracted: false,
    reason: "No resume document uploaded.",
  };
}

export interface StudentCompleteProfile {
  user: any;
  documents: DocumentItem[];
  resume: StudentResumeResult;
  certificates: any[];
  projects: any[];
  experience: any[];
  applications: any[];
}

export async function getStudentCompleteProfile(
  userOrId: any
): Promise<StudentCompleteProfile | null> {
  const usersCol = await getUsersCollection();

  let user = typeof userOrId === "object" && userOrId !== null && (userOrId.email || userOrId.role)
    ? userOrId
    : null;

  if (!user) {
    user = await usersCol.findOne(toIdFilter(userOrId));
  }

  if (!user) return null;

  const conditions = getStudentIdConditions(user);
  const filter = conditions.length > 0 ? { $or: conditions } : { studentId: user.id ?? user._id };

  const [
    docs,
    resume,
    certsCol,
    projectsCol,
    expCol,
    appsCol,
  ] = await Promise.all([
    getStudentDocuments(user),
    getStudentResume(user),
    getCertificatesCollection(),
    getStudentProjectsCollection(),
    getStudentExperienceCollection(),
    getApplicationsCollection(),
  ]);

  const [certificates, projects, experience, applications] = await Promise.all([
    certsCol.find(filter).sort({ uploadedAt: -1 }).toArray(),
    projectsCol.find(filter).sort({ createdAt: -1 }).toArray(),
    expCol.find(filter).sort({ startDate: -1 }).toArray(),
    appsCol.find(filter).sort({ appliedAt: -1 }).toArray(),
  ]);

  return {
    user,
    documents: docs,
    resume,
    certificates,
    projects,
    experience,
    applications,
  };
}
