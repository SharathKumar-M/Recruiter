import { Router } from "express";
import {
  getUsersCollection,
  getApplicationsCollection,
  getJobsCollection,
  getNextSequence,
} from "@workspace/db";
import { SyncUserBody } from "@workspace/api-zod";
import type { UserRole } from "@workspace/db/schema";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/auth/sync", async (req, res) => {
  try {
    const parsed = SyncUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error });
      return;
    }
    const { clerkId, email, role, displayName, companyName } = parsed.data;

    let verifiedClerkId: string;

    const demoRole = req.headers["x-demo"] as string | undefined;
    if (demoRole && process.env.NODE_ENV !== "production") {
      verifiedClerkId = clerkId.startsWith("demo_") ? clerkId : `demo_${demoRole}_${clerkId}`;
    } else {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({
          error: "Unauthorized: Missing or invalid authentication token",
        });
        return;
      }

      if (clerkId && clerkId !== userId) {
        res.status(403).json({
          error: "Forbidden: Client clerkId does not match authenticated session",
        });
        return;
      }
      verifiedClerkId = userId;
    }

    const assignedRole: UserRole = role === "recruiter" ? "recruiter" : "student";
    const users = await getUsersCollection();
    const existing = await users.findOne({ clerkId: verifiedClerkId });

    if (existing) {
      // Check if existing user was auto-created as a placeholder by the prior requireAuth bug:
      // Such accounts have email `${userId}@clerk.user` and displayName "New User" with role "student"
      const isAutoCreatedPlaceholder =
        existing.role === "student" &&
        assignedRole === "recruiter" &&
        (existing.email?.endsWith("@clerk.user") || existing.displayName === "New User");

      if (isAutoCreatedPlaceholder) {
        const applicationsCol = await getApplicationsCollection();
        const userConditions: any[] = [];
        if (existing.id !== undefined) userConditions.push(existing.id);
        if (existing._id) {
          userConditions.push(existing._id);
          userConditions.push(existing._id.toString());
        }
        const appCount = await applicationsCol.countDocuments({
          studentId: { $in: userConditions },
        });

        if (appCount === 0) {
          const now = new Date();
          const cleanEmail = email && !email.endsWith("@clerk.user") ? email : existing.email;
          const cleanName = displayName && displayName !== "New User" ? displayName : existing.displayName;
          await users.updateOne(
            { _id: existing._id },
            {
              $set: {
                role: "recruiter",
                email: cleanEmail,
                displayName: cleanName,
                companyName: companyName ?? existing.companyName ?? null,
                updatedAt: now,
              },
            }
          );
          req.log.info(
            { userId: existing.id, clerkId: verifiedClerkId },
            "Repaired auto-created placeholder user to recruiter"
          );
          res.json({
            userId: existing.id ?? existing._id.toString(),
            role: "recruiter",
          });
          return;
        }
      }

      // Preserve existing database role to prevent tampering or unauthorized privilege escalation
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (email && !email.endsWith("@clerk.user") && existing.email?.endsWith("@clerk.user")) {
        updates.email = email;
      }
      if (displayName && existing.displayName === "New User" && displayName !== "New User") {
        updates.displayName = displayName;
      }
      if (companyName && existing.role === "recruiter" && !existing.companyName) {
        updates.companyName = companyName;
      }
      if (Object.keys(updates).length > 1) {
        await users.updateOne({ _id: existing._id }, { $set: updates });
      }

      res.json({
        userId: existing.id ?? existing._id.toString(),
        role: existing.role,
      });
      return;
    }

    const seqId = await getNextSequence("users");
    const now = new Date();
    const newUser = {
      id: seqId,
      clerkId: verifiedClerkId,
      email: email || `${verifiedClerkId}@clerk.user`,
      role: assignedRole,
      displayName: displayName || "User",
      companyName: assignedRole === "recruiter" ? (companyName ?? null) : null,
      skills: [],
      programmingLanguages: [],
      frameworks: [],
      databases: [],
      tools: [],
      otherSkills: [],
      isDiscoverable: true,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await users.insertOne(newUser);
      res.json({ userId: seqId, role: assignedRole });
    } catch (insertErr: any) {
      if (insertErr?.code === 11000) {
        const conflict = await users.findOne({ clerkId: verifiedClerkId });
        if (conflict) {
          res.json({
            userId: conflict.id ?? conflict._id.toString(),
            role: conflict.role,
          });
          return;
        }
      }
      throw insertErr;
    }
  } catch (err) {
    req.log.error({ err }, "sync user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/resolve-role", requireAuth, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { targetRole, companyName } = req.body;

    if (targetRole !== "student" && targetRole !== "recruiter") {
      res.status(400).json({
        error: "Invalid targetRole. Must be 'student' or 'recruiter'.",
      });
      return;
    }

    if (user.role === targetRole) {
      res.json({
        success: true,
        message: `Account already has role: ${targetRole}`,
        role: user.role,
        userId: user.id ?? user._id?.toString(),
      });
      return;
    }

    const [applicationsCol, jobsCol, usersCol] = await Promise.all([
      getApplicationsCollection(),
      getJobsCollection(),
      getUsersCollection(),
    ]);

    const userConditions: any[] = [];
    if (user.id !== undefined) userConditions.push(user.id);
    if (user._id) {
      userConditions.push(user._id);
      userConditions.push(user._id.toString());
    }

    if (targetRole === "recruiter") {
      const appCount = await applicationsCol.countDocuments({
        studentId: { $in: userConditions },
      });
      if (appCount > 0) {
        res.status(400).json({
          error: "Cannot change role to recruiter: Account has existing job applications as a student.",
        });
        return;
      }
    } else {
      const jobCount = await jobsCol.countDocuments({
        recruiterId: { $in: userConditions },
      });
      if (jobCount > 0) {
        res.status(400).json({
          error: "Cannot change role to student: Account has active job postings as a recruiter.",
        });
        return;
      }
    }

    const updates: Record<string, any> = {
      role: targetRole,
      updatedAt: new Date(),
    };
    if (targetRole === "recruiter" && companyName) {
      updates.companyName = companyName;
    }

    await usersCol.updateOne(
      { _id: user._id },
      { $set: updates }
    );

    req.log.info(
      { userId: user.id, oldRole: user.role, newRole: targetRole },
      "User role explicitly resolved"
    );

    res.json({
      success: true,
      message: `Account role updated to ${targetRole}.`,
      role: targetRole,
      userId: user.id ?? user._id?.toString(),
    });
  } catch (err) {
    req.log.error({ err }, "resolve role error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    res.json({
      id: user.id ?? user._id?.toString(),
      clerkId: user.clerkId,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      companyName: user.companyName ?? null,
      college: user.college ?? null,
      skills: user.skills ?? [],
      linkedinUrl: user.linkedinUrl ?? null,
      githubUrl: user.githubUrl ?? null,
      portfolioUrl: user.portfolioUrl ?? null,
      resumeUrl: user.resumeUrl ?? null,
      resumeFilename: user.resumeFilename ?? null,
      photoUrl: user.photoUrl ?? null,
      appliedJobIds: user.appliedJobIds ?? [],
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : (user.createdAt || new Date().toISOString()),
    });
  } catch (err) {
    req.log.error({ err }, "get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
