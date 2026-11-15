import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { ObjectId } from "mongodb";
import { getUsersCollection, getNextSequence } from "@workspace/db";
import type { User, UserRole } from "@workspace/db/schema";

type DbUser = User & {
  _id: ObjectId;
};

/**
 * Find or create a user using their Clerk ID.
 */
async function resolveUser(req: Request): Promise<DbUser | null> {
  const users = await getUsersCollection();

  // Development-only demo login
  const demoRole = req.headers["x-demo"] as string | undefined;

  if (demoRole && process.env.NODE_ENV !== "production") {
    const roleToUse: UserRole = demoRole === "recruiter" ? "recruiter" : "student";

    const existingDemoUser = await users.findOne({
      role: roleToUse,
      clerkId: { $regex: `^demo_${roleToUse}_` },
    });

    if (existingDemoUser) {
      return existingDemoUser as DbUser;
    }

    const now = new Date();
    const seqId = await getNextSequence("users");

    const demoUser = {
      id: seqId,
      clerkId: `demo_${roleToUse}_${Date.now()}`,
      email: `${roleToUse}@verifai.com`,
      role: roleToUse,
      displayName: roleToUse === "recruiter" ? "Demo Recruiter" : "Demo Student",
      companyName: roleToUse === "recruiter" ? "Acme Corp" : null,
      photoUrl: null,
      college: roleToUse === "student" ? "Government Engineering College Hassan" : null,
      degree: roleToUse === "student" ? "B.E." : null,
      branch: roleToUse === "student" ? "Computer Science" : null,
      skills: ["JavaScript", "React", "Node.js", "MongoDB"],
      programmingLanguages: ["JavaScript", "TypeScript"],
      frameworks: ["React", "Express"],
      databases: ["MongoDB"],
      tools: ["Git", "GitHub"],
      otherSkills: [],
      isDiscoverable: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await users.insertOne(demoUser);

    return {
      ...demoUser,
      _id: result.insertedId,
    } as DbUser;
  }

  // Clerk authentication
  const { userId } = getAuth(req);

  if (!userId) {
    return null;
  }

  const user = await users.findOne({
    clerkId: userId,
  });

  return user ? (user as DbUser) : null;
}

/**
 * Authentication middleware
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await resolveUser(req);

    if (!user) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    (req as any).dbUser = user;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Student-only middleware
 */
export function requireStudent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  requireAuth(req, res, (error?: any) => {
    if (error) {
      next(error);
      return;
    }

    const user = (req as any).dbUser;

    if (user.role !== "student") {
      res.status(403).json({
        error: "Students only",
      });
      return;
    }

    next();
  });
}

/**
 * Recruiter-only middleware
 */
export function requireRecruiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  requireAuth(req, res, (error?: any) => {
    if (error) {
      next(error);
      return;
    }

    const user = (req as any).dbUser;

    if (user.role !== "recruiter") {
      res.status(403).json({
        error: "Recruiters only",
      });
      return;
    }

    next();
  });
}
