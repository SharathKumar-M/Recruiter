import "dotenv/config";
import {
  MongoClient,
  type Collection,
  type Document,
  type Db,
} from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "MONGODB_URI must be set in your environment variables.",
  );
}

const databaseName =
  process.env.MONGODB_DATABASE ?? "recruiter_portal";

const client = new MongoClient(uri);

let connectionPromise: Promise<Db> | undefined;

export function getMongoDb(): Promise<Db> {
  if (!connectionPromise) {
    connectionPromise = client
      .connect()
      .then(() => client.db(databaseName))
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
}

export async function getCollection<T extends Document>(
  name: string,
): Promise<Collection<T>> {
  const database = await getMongoDb();
  return database.collection<T>(name);
}

export async function initializeMongoDb(): Promise<void> {
  const database = await getMongoDb();

  await Promise.all([
    database.collection("users").createIndex(
      { clerkId: 1 },
      { unique: true },
    ),
    database.collection("users").createIndex(
      { email: 1 },
      { unique: true },
    ),
    database.collection("applications").createIndex(
      { jobId: 1, studentId: 1 },
      { unique: true },
    ),
    database.collection("jobs").createIndex(
      { recruiterId: 1, postedAt: -1 },
    ),
    database.collection("applications").createIndex(
      { studentId: 1, appliedAt: -1 },
    ),
    database.collection("verifications").createIndex(
      { studentId: 1, analyzedAt: -1 },
    ),
  ]);
}