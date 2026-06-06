import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!user[0]) {
    res.status(401).json({ error: "User not found in database. Please sync first." });
    return;
  }
  (req as any).dbUser = user[0];
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
