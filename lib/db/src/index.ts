
import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME =
  process.env.MONGODB_DATABASE || "recruiter_student_portal";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI must be set in your environment variables.");
}

const client = new MongoClient(MONGODB_URI);

let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

/**
 * Connect to MongoDB Atlas.
 * Reuses the existing connection instead of creating
 * a new connection for every database operation.
 */
export async function connectDB(): Promise<Db> {
  if (db) {
    return db;
  }

  if (!connectionPromise) {
    connectionPromise = client
      .connect()
      .then(() => {
        db = client.db(DATABASE_NAME);
        console.log(`MongoDB connected: ${DATABASE_NAME}`);
        return db;
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  return connectionPromise;
}

/**
 * Get the connected database.
 */
export async function getDB(): Promise<Db> {
  return connectDB();
}

/**
 * Close the MongoDB connection.
 */
export async function closeDB(): Promise<void> {
  await client.close();
  db = null;
  connectionPromise = null;
}

export { client };
