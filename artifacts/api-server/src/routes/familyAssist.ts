import { Router } from "express";
import { eq, ilike, or, and } from "drizzle-orm";
import { db, familiesTable, usersTable, childrenTable, classesTable, attendanceTable, pickupDelegatesTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { smsDelegateOtp } from "../services/sms";

const router = Router();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateGuestCode(): string {
  return "G-" + Math.floor(1000 + Math.random() * 9000).toString();
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/family-assist/search", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const q = ((req.query.q as string) || "").trim();
  if (!q) { res.json([]); return; }

  const matchingUsers = await db.select().from(usersTable).where(
    or(
      ilike(usersTable.firstName, `%${q}%`),
      ilike(usersTable.lastName, `%${q}%`),
      ilike(usersTable.phone, `%${q}%`),
    )
  );

  if (matchingUsers.length === 0) { res.json([]); return; }
  const userIds = matchingUsers.map(u => u.id);

  const families = await db.select().from(familiesTable).where(
    or(...userIds.flatMap(id => [
      eq(familiesTable.parent1Id, id),
      eq(familiesTable.parent2Id, id),
    ]))
  );

  const result = await Promise.all(families.map(async (fam) => {
    const parent = matchingUsers.find(u => u.id === fam.parent1Id || u.id === fam.parent2Id);
    const children = await db.select().from(childrenTable).where(eq(childrenTable.familyId, fam.id));
    const childrenWithClass = await Promise.all(children.map(async (c) => {
      let currentClass = null;
      if (c.currentClassId) {
        const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, c.currentClassId));
        currentClass = cls ?? null;
      }
      return { ...c, currentClass };
    }));
    return {
      id: fam.id,
      familyCode: fam.familyCode,
      parentName: parent ? `${parent.firstName} ${parent.lastName}` : "Unknown",
      parentPhone: parent?.phone ?? null,
      children: childrenWithClass,
    };
  }));

  res.json(result);
});

router.post("/family-assist/delegate", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const { childId, delegateName, delegatePhone } = req.body as { childId?: number; delegateName?: string; delegatePhone?: string };
  if (!childId || !delegateName || !delegatePhone) {
    res.status(400).json({ error: "childId, delegateName and delegatePhone are required" });
    return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, Number(childId)));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }

  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const childName = `${child.firstName} ${child.lastName}`;

  const [delegate] = await db.insert(pickupDelegatesTable).values({
    childId: Number(childId),
    name: delegateName,
    phone: delegatePhone,
    otpCode: otp,
    otpExpiresAt,
    parentApproved: true,
  }).returning();

  await smsDelegateOtp(delegatePhone, delegateName, childName, otp, req.log);

  res.status(201).json({ ...delegate, otpCode: otp });
});

router.post("/family-assist/checkin", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const { childId, serviceSlot } = req.body as { childId?: number; serviceSlot?: string };
  if (!childId || !serviceSlot) {
    res.status(400).json({ error: "childId and serviceSlot are required" });
    return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, Number(childId)));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }
  if (!child.currentClassId) { res.status(400).json({ error: "Child is not assigned to a class" }); return; }

  const serviceDate = todayString();
  const slotsToBook = serviceSlot === "both" ? ["7am", "10:30am"] : [serviceSlot];

  const results = [];
  for (const slot of slotsToBook) {
    const [existing] = await db.select().from(attendanceTable)
      .where(and(
        eq(attendanceTable.childId, child.id),
        eq(attendanceTable.serviceDate, serviceDate),
        eq(attendanceTable.serviceSlot, slot),
      ));
    if (existing) { results.push(existing); continue; }

    const [record] = await db.insert(attendanceTable).values({
      childId: child.id,
      classId: child.currentClassId,
      serviceDate,
      serviceSlot: slot,
      checkInTime: new Date(),
      checkedInBy: req.user!.userId,
      status: "dropped_off",
    }).returning();
    results.push(record);
  }

  res.json({ success: true, attendance: results, childName: `${child.firstName} ${child.lastName}` });
});

router.post("/family-assist/guest", authMiddleware, requireRoles("super_admin", "admin", "attendant"), async (req, res): Promise<void> => {
  const { parentName, parentPhone, childFirstName, childLastName, dob, gender, serviceSlot } =
    req.body as { parentName?: string; parentPhone?: string; childFirstName?: string; childLastName?: string; dob?: string; gender?: string; serviceSlot?: string };

  if (!parentName || !childFirstName || !childLastName || !dob || !gender || !serviceSlot) {
    res.status(400).json({ error: "All required fields must be provided" });
    return;
  }

  const guestCode = generateGuestCode();

  const [family] = await db.insert(familiesTable).values({
    familyCode: guestCode,
    notes: `Walk-in guest. Parent: ${parentName}${parentPhone ? `, Phone: ${parentPhone}` : ""}`,
    isGuest: true,
  }).returning();

  const birthDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);

  const allClasses = await db.select().from(classesTable);
  const matchByAge = allClasses.find(c => c.name.toLowerCase() === `class ${age}`);
  const assignedClassId = matchByAge?.id ?? (allClasses[0]?.id ?? null);

  const [child] = await db.insert(childrenTable).values({
    familyId: family.id,
    firstName: childFirstName,
    lastName: childLastName,
    dob,
    gender: gender as "male" | "female",
    currentClassId: assignedClassId,
  }).returning();

  let attendance = null;
  if (assignedClassId) {
    const serviceDate = todayString();
    const slotsToBook = serviceSlot === "both" ? ["7am", "10:30am"] : [serviceSlot];
    for (const slot of slotsToBook) {
      const [record] = await db.insert(attendanceTable).values({
        childId: child.id,
        classId: assignedClassId,
        serviceDate,
        serviceSlot: slot,
        checkInTime: new Date(),
        checkedInBy: req.user!.userId,
        status: "dropped_off",
      }).returning();
      attendance = record;
    }
  }

  const assignedClass = assignedClassId ? allClasses.find(c => c.id === assignedClassId) ?? null : null;

  res.status(201).json({
    success: true,
    guestCode,
    family,
    child: { ...child, currentClass: assignedClass },
    attendance,
    parentName,
    parentPhone: parentPhone ?? null,
  });
});

export default router;
