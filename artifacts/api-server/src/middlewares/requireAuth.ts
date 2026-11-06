import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function resolveUser(req: Request): Promise<(typeof usersTable.$inferSelect) | null> {
  // Dev bypass: if x-demo header is set and not in production, use or create seeded demo user
  const demoRole = req.headers["x-demo"] as string | undefined;
  if (demoRole && process.env.NODE_ENV !== "production") {
    const roleToUse = demoRole === "recruiter" ? "recruiter" : "student";
    const demoUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, roleToUse))
      .limit(1);

    if (demoUser[0]) {
      return demoUser[0];
    }

    // Auto-seed demo user if none exists
    const [created] = await db.insert(usersTable).values({
      clerkId: `demo_${roleToUse}_${Date.now()}`,
      email: `${roleToUse}@verifai.com`,
      role: roleToUse,
      displayName: roleToUse === "recruiter" ? "Demo Recruiter" : "Demo Student",
      companyName: roleToUse === "recruiter" ? "Acme Corp" : null,
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
      college: roleToUse === "student" ? "Stanford University" : null,
      degree: roleToUse === "student" ? "B.S. Computer Science" : null,
      branch: roleToUse === "student" ? "Software Engineering" : null,
      graduationYear: "2027",
      professionalSummary: "Dedicated software engineering professional building modern full-stack web applications.",
      isDiscoverable: true,
    }).returning();

    return created;
  }

  const { userId } = getAuth(req);
  if (!userId) return null;

  let user = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (user[0]) return user[0];

  // Auto-provision user on first Clerk login
  const [created] = await db.insert(usersTable).values({
    clerkId: userId,
    email: `${userId}@clerk.user`,
    role: "student", // default role for new signup
    displayName: "New User",
    skills: [],
    isDiscoverable: true,
  }).returning();

  return created;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
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
