import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { generateToken, authMiddleware } from "../middlewares/auth";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }
  if (user.status === "pending_approval") {
    res.status(403).json({ error: "Forbidden", message: "Your account is pending admin approval. You will be notified once approved." });
    return;
  }
  if (user.status === "suspended") {
    res.status(403).json({ error: "Forbidden", message: "Your account has been suspended. Please contact the church administrator." });
    return;
  }
  if (!user.isActive) {
    res.status(401).json({ error: "Unauthorized", message: "Account is inactive" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      status: user.status,
      photoUrl: user.photoUrl,
      dob: user.dob,
      gender: user.gender,
      placeOfWork: user.placeOfWork,
      communicationPrefs: user.communicationPrefs,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Bad request", message: parsed.error.message });
    return;
  }
  const { email, password, firstName, lastName, phone, role } = parsed.data;
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Conflict", message: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const requiresApproval = role === "admin" || role === "teacher";
  const userStatus = requiresApproval ? "pending_approval" : "active";
  const isActive = !requiresApproval;

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      role: role as "super_admin" | "admin" | "teacher" | "attendant" | "parent",
      status: userStatus,
      isActive,
    })
    .returning();

  if (requiresApproval) {
    res.status(201).json({
      pending: true,
      message: "Registration successful. Your account is pending admin approval. You will be notified once approved.",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    });
    return;
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      status: user.status,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
    },
  });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    status: user.status,
    photoUrl: user.photoUrl,
    dob: user.dob,
    gender: user.gender,
    placeOfWork: user.placeOfWork,
    communicationPrefs: user.communicationPrefs,
    createdAt: user.createdAt,
  });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Logged out" });
});

export default router;
