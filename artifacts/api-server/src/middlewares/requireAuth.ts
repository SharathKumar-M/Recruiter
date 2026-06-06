import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function resolveUser(req: Request): Promise<(typeof usersTable.$inferSelect) | null> {
  // Dev bypass: if x-demo header is set and not in production, use seeded demo user
  const demoRole = req.headers["x-demo"] as string | undefined;
  if (demoRole && process.env.NODE_ENV !== "production") {
    const demoUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, demoRole as "student" | "recruiter"))
      .limit(1);
    return demoUser[0] ?? null;
  }

  const { userId } = getAuth(req);
  if (!userId) return null;

  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  return user[0] ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const demoRole = req.headers["x-demo"] as string | undefined;
  if (!demoRole || process.env.NODE_ENV === "production") {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ error: "User not found in database. Please sync first." });
    return;
  }
  (req as any).dbUser = user;
  next();
}

export async function requireStudent(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).dbUser;
    if (user.role !== "student") {
      res.status(403).json({ error: "Students only" });
      return;
    }
    next();
  });
}

export async function requireRecruiter(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    const user = (req as any).dbUser;
    if (user.role !== "recruiter") {
      res.status(403).json({ error: "Recruiters only" });
      return;
    }
    next();
  });
}
