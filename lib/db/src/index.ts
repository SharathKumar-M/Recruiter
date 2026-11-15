import dotenv from "dotenv";
import path from "node:path";
import { Readable } from "node:stream";
import { MongoClient, Db, Collection, ObjectId, GridFSBucket, type Document } from "mongodb";

// Load the root .env file from the API workspace directory.
dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});
import * as schema from "./schema";

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || "recruiter_portal";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI must be set in your environment variables.");
}

const client = new MongoClient(MONGODB_URI);

let dbInstance: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

/**
 * Connect to MongoDB Atlas.
 * Reuses the existing connection instance across the application.
 */
export async function connectDB(): Promise<Db> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!connectionPromise) {
    connectionPromise = client
      .connect()
      .then((c) => {
        dbInstance = c.db(DATABASE_NAME);
        console.log(`[MongoDB] Successfully connected to database: ${DATABASE_NAME}`);
        return dbInstance;
      })
      .catch((error) => {
        connectionPromise = null;
        console.error("[MongoDB] Connection failure:", error.message);
        throw error;
      });
  }

  return connectionPromise;
}

/**
 * Get active database instance.
 */
export async function getDB(): Promise<Db> {
  return connectDB();
}

/**
 * Close the MongoDB connection on application shutdown.
 */
export async function closeDB(): Promise<void> {
  if (client) {
    await client.close();
    dbInstance = null;
    connectionPromise = null;
    console.log("[MongoDB] Connection closed successfully.");
  }
}

/**
 * Auto-increment counter generator to maintain integer IDs
 * compatible with OpenAPI spec and frontend models.
 */
export async function getNextSequence(sequenceName: string): Promise<number> {
  const db = await getDB();
  const counters = db.collection<{ _id: string; seq: number }>("counters");
  const result = await counters.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return result?.seq ?? Date.now();
}

/**
 * Convert string or number ID to a safe query filter.
 * Matches either the numeric id field or the MongoDB _id ObjectId field.
 */
export function toIdFilter(id: string | number | ObjectId): Document {
  if (id instanceof ObjectId) {
    return { _id: id };
  }
  const str = String(id).trim();
  const num = Number(str);
  const isValidNum = !Number.isNaN(num) && Number.isInteger(num);
  const isValidObjId = ObjectId.isValid(str) && str.length === 24;

  if (isValidNum && isValidObjId) {
    return { $or: [{ id: num }, { _id: new ObjectId(str) }] };
  }
  if (isValidNum) {
    return { id: num };
  }
  if (isValidObjId) {
    return { _id: new ObjectId(str) };
  }
  return { id: str };
}

/**
 * Safely parse a value to an ObjectId or null if invalid.
 */
export function toObjectId(id: unknown): ObjectId | null {
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id) && id.length === 24) {
    return new ObjectId(id);
  }
  return null;
}

// ── Typed Collection Accessors ──────────────────────────────────────────────

export async function getUsersCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("users");
}

export async function getJobsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("jobs");
}

export async function getApplicationsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("applications");
}

export async function getCertificatesCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("certificates");
}

export async function getVerificationsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("verifications");
}

export async function getStudentProjectsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("studentProjects");
}

export async function getStudentExperienceCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("studentExperience");
}

export async function getDocumentsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("documents");
}

export async function getNotificationsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("notifications");
}

export async function getRecruiterNotesCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("recruiterNotes");
}

export async function getCandidateScorecardsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("candidateScorecards");
}

export async function getInterviewsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("interviews");
}

export async function getTalentPoolsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("talentPools");
}

export async function getTalentPoolMembersCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("talentPoolMembers");
}

export async function getAuditLogsCollection(): Promise<Collection<any>> {
  const db = await getDB();
  return db.collection("auditLogs");
}

// ── GridFS Storage for Documents ──────────────────────────────────────────────

export async function getGridFSBucket(bucketName = "documents_files"): Promise<GridFSBucket> {
  const db = await getDB();
  return new GridFSBucket(db, { bucketName });
}

export async function uploadToGridFS(
  filename: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, any>
): Promise<ObjectId> {
  const bucket = await getGridFSBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        ...metadata,
        contentType,
        uploadedAt: new Date(),
      },
    });
    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => {
      resolve(uploadStream.id as ObjectId);
    });
  });
}

export async function downloadFromGridFS(
  fileId: ObjectId | string
): Promise<{ stream: NodeJS.ReadableStream; filename: string; contentType: string; length: number; metadata?: any } | null> {
  const objId = toObjectId(fileId);
  if (!objId) return null;
  const bucket = await getGridFSBucket();
  const files = await bucket.find({ _id: objId }).toArray();
  if (files.length === 0) return null;
  const file = files[0];
  const stream = bucket.openDownloadStream(objId);
  const detectedContentType = (file.metadata as any)?.contentType || "application/octet-stream";
  return {
    stream,
    filename: file.filename,
    contentType: detectedContentType,
    length: file.length,
    metadata: file.metadata,
  };
}

export async function getGridFSBuffer(fileId: ObjectId | string): Promise<Buffer | null> {
  const objId = toObjectId(fileId);
  if (!objId) return null;
  const bucket = await getGridFSBucket();
  const files = await bucket.find({ _id: objId }).toArray();
  if (files.length === 0) return null;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = bucket.openDownloadStream(objId);
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function deleteFromGridFS(fileId: ObjectId | string): Promise<boolean> {
  const objId = toObjectId(fileId);
  if (!objId) return false;
  try {
    const bucket = await getGridFSBucket();
    await bucket.delete(objId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize all critical MongoDB indexes once at server startup.
 */
export async function initializeMongoDb(): Promise<void> {
  const db = await getDB();

  try {
    await Promise.all([
      db.collection("users").createIndex({ clerkId: 1 }, { unique: true }),
      db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true }),
      db.collection("users").createIndex({ role: 1 }),
      db.collection("users").createIndex({ id: 1 }, { unique: true, sparse: true }),

      db.collection("jobs").createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection("jobs").createIndex({ recruiterId: 1, postedAt: -1 }),
      db.collection("jobs").createIndex({ isActive: 1, postedAt: -1 }),

      db.collection("applications").createIndex({ id: 1 }, { unique: true, sparse: true }),
      db.collection("applications").createIndex({ jobId: 1, studentId: 1 }),
      db.collection("applications").createIndex({ studentId: 1, appliedAt: -1 }),

      db.collection("certificates").createIndex({ studentId: 1, uploadedAt: -1 }),
      db.collection("verifications").createIndex({ studentId: 1, analyzedAt: -1 }),
      db.collection("studentProjects").createIndex({ studentId: 1 }),
      db.collection("studentExperience").createIndex({ studentId: 1 }),
      db.collection("documents").createIndex({ studentId: 1 }),
      db.collection("notifications").createIndex({ studentId: 1, createdAt: -1 }),
      db.collection("recruiterNotes").createIndex({ applicationId: 1 }),
      db.collection("candidateScorecards").createIndex({ applicationId: 1 }),
      db.collection("interviews").createIndex({ recruiterId: 1 }),
      db.collection("talentPools").createIndex({ recruiterId: 1 }),
      db.collection("talentPoolMembers").createIndex({ poolId: 1, studentId: 1 }),
    ]);
    console.log("[MongoDB] Collections and indexes initialized successfully.");
  } catch (err: any) {
    console.warn("[MongoDB] Index initialization notice:", err.message);
  }
}

export { client, schema };
export * from "./schema";
