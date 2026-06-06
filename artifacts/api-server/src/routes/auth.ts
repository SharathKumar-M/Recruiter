import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
    if (existing[0]) {
      res.json({ userId: existing[0].id, role: existing[0].role });
      return;
    }

    const [created] = await db.insert(usersTable).values({
      clerkId,
      email,
      role,
      displayName,
      companyName: companyName ?? null,
      skills: [],
    }).returning();

    res.json({ userId: created.id, role: created.role });
  } catch (err) {
    req.log.error({ err }, "sync user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    res.json({
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      companyName: user.companyName,
      college: user.college,
      skills: user.skills ?? [],
      linkedinUrl: user.linkedinUrl,
      githubUrl: user.githubUrl,
      portfolioUrl: user.portfolioUrl,
      resumeUrl: user.resumeUrl,
      resumeFilename: user.resumeFilename,
      photoUrl: user.photoUrl,
      appliedJobIds: [],
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
