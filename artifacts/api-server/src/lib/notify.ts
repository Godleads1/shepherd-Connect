import { db, notificationsTable, usersTable, familiesTable, childrenTable, classesTable, teachersTable, teacherAllocationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

type Channel = "in_app" | "whatsapp" | "sms" | "email";

export async function sendNotification(opts: {
  userId: number;
  type: string;
  title: string;
  message: string;
  channel?: Channel;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(notificationsTable).values({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    channel: (opts.channel ?? "in_app") as Channel,
    readStatus: false,
    metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
  });
}

export async function sendToRole(opts: {
  role: "parent" | "teacher" | "attendant" | "admin" | "super_admin";
  type: string;
  title: string;
  message: string;
  channel?: Channel;
  metadata?: Record<string, unknown>;
}) {
  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, opts.role)));
  if (users.length === 0) return;
  await db.insert(notificationsTable).values(
    users.map(u => ({
      userId: u.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      channel: (opts.channel ?? "in_app") as Channel,
      readStatus: false,
      metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
    }))
  );
}

export async function notifyChildCheckedIn(childId: number, classId: number, serviceSlot: string) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "class";

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  const now = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_checked_in",
      title: "Drop-off Confirmed",
      message: `${child.firstName} has been safely dropped off for the ${serviceSlot} service at ${now}. They will be escorted to ${className} shortly.`,
      metadata: { childId, classId, serviceSlot },
    });
  }
}

export async function notifyChildInTransit(childId: number, classId: number) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "class";

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_in_transit",
      title: "Child En Route to Class",
      message: `${child.firstName} is being escorted to ${className} right now.`,
      metadata: { childId, classId },
    });
  }
}

export async function notifyChildArrivedInClass(childId: number, classId: number) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, classId));
  const className = cls?.name ?? "class";

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  let teacherName: string | null = null;
  if (cls) {
    const [alloc] = await db
      .select()
      .from(teacherAllocationsTable)
      .where(eq(teacherAllocationsTable.classId, cls.id))
      .limit(1);
    if (alloc) {
      const [teacher] = await db.select().from(teachersTable).where(eq(teachersTable.id, alloc.teacherId));
      if (teacher) {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, teacher.userId));
        if (u) teacherName = `${u.firstName} ${u.lastName}`;
      }
    }
  }

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_arrived_in_class",
      title: "Child Safely in Class",
      message: teacherName
        ? `${child.firstName} is now safely in ${className} with Teacher ${teacherName}. Have a blessed service!`
        : `${child.firstName} is now safely in ${className}. Have a blessed service!`,
      metadata: { childId, classId, teacherName },
    });
  }
}

export async function notifyChildPickedUp(childId: number) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) return;

  const [family] = await db.select().from(familiesTable).where(eq(familiesTable.id, child.familyId));
  const parentIds: number[] = [];
  if (family?.parent1Id) parentIds.push(family.parent1Id);
  if (family?.parent2Id) parentIds.push(family.parent2Id);

  const now = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  for (const uid of parentIds) {
    await sendNotification({
      userId: uid,
      type: "child_picked_up",
      title: "Pick-up Confirmed",
      message: `${child.firstName} has been safely picked up at ${now}. God bless your family!`,
      metadata: { childId },
    });
  }
}

export async function broadcastEmergency(opts: {
  type: string;
  level: string;
  description: string;
  emergencyId: number;
}) {
  const users = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.isActive, true));

  const levelLabel: Record<string, string> = {
    L1: "Local Area",
    L2: "Department",
    L3: "Building-Wide",
    L4: "CRITICAL — Full Community",
  };

  const title = `⚠️ EMERGENCY ALERT — Level ${opts.level} (${levelLabel[opts.level] ?? opts.level})`;
  const message = `${opts.type.replace(/_/g, " ").toUpperCase()} — ${opts.description}. All staff and parents please respond immediately.`;

  if (users.length === 0) return;

  await db.insert(notificationsTable).values(
    users.map(u => ({
      userId: u.id,
      type: "emergency_alert",
      title,
      message,
      channel: "in_app" as Channel,
      readStatus: false,
      metadataJson: JSON.stringify({ emergencyId: opts.emergencyId, level: opts.level }),
    }))
  );
}
