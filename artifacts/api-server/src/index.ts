import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../../.env"),
});
import app from "./app";
import { logger } from "./lib/logger";
import { connectDB, initializeMongoDb, closeDB } from "@workspace/db";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    // Ensure the backend waits for the database connection before accepting requests
    await connectDB();
    await initializeMongoDb();

    const server = app.listen(port, "0.0.0.0", () => {
      logger.info({ port }, "Server listening on 0.0.0.0");
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received. Closing server and database connection...");
      server.close(async () => {
        await closeDB();
        logger.info("Graceful shutdown complete.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "Failed to start server due to database connection error");
    process.exit(1);
  }
}

startServer();
