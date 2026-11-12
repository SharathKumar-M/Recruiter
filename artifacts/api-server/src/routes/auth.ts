import { Router } from "express";
import { getUsersCollection, getNextSequence } from "@workspace/db";
import { SyncUserBody } from "@workspace/api-zod";
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

    // Security check: ensure valid role
    const assignedRole = role === "recruiter" ? "recruiter" : "student";

    const users = await getUsersCollection();
    const existing = await users.findOne({ clerkId });
    if (existing) {
      // Return existing database role to prevent privilege escalation / tampering
      res.json({ userId: existing.id ?? existing._id.toString(), role: existing.role });
      return;
    }

    const seqId = await getNextSequence("users");
    const now = new Date();
    const newUser = {
      id: seqId,
      clerkId,
      email,
      role: assignedRole,
      displayName,
      companyName: companyName ?? null,
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

    await users.insertOne(newUser);
    res.json({ userId: seqId, role: assignedRole });
  } catch (err) {
    req.log.error({ err }, "sync user error");
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
