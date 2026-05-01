import bcrypt from "bcryptjs";
import { db, usersTable, familiesTable, childrenTable, classesTable, classAssignmentsTable, teachersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Super admin
  const superAdminHash = await bcrypt.hash("admin123", 12);
  const [superAdmin] = await db.insert(usersTable).values({
    email: "superadmin@shepherd.com",
    passwordHash: superAdminHash,
    firstName: "Samuel",
    lastName: "Okonkwo",
    phone: "+2348012345678",
    role: "super_admin",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Admin
  const adminHash = await bcrypt.hash("admin123", 12);
  const [admin] = await db.insert(usersTable).values({
    email: "admin@shepherd.com",
    passwordHash: adminHash,
    firstName: "Grace",
    lastName: "Adeyemi",
    phone: "+2348023456789",
    role: "admin",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Teacher 1
  const teacherHash = await bcrypt.hash("teacher123", 12);
  const [teacher1User] = await db.insert(usersTable).values({
    email: "teacher1@shepherd.com",
    passwordHash: teacherHash,
    firstName: "Emmanuel",
    lastName: "Nwosu",
    phone: "+2348034567890",
    role: "teacher",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Teacher 2
  const [teacher2User] = await db.insert(usersTable).values({
    email: "teacher2@shepherd.com",
    passwordHash: teacherHash,
    firstName: "Blessing",
    lastName: "Okafor",
    phone: "+2348045678901",
    role: "teacher",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Attendant
  const attendantHash = await bcrypt.hash("attend123", 12);
  const [attendant] = await db.insert(usersTable).values({
    email: "attendant@shepherd.com",
    passwordHash: attendantHash,
    firstName: "Joseph",
    lastName: "Eze",
    phone: "+2348056789012",
    role: "attendant",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Parent 1
  const parentHash = await bcrypt.hash("parent123", 12);
  const [parent1] = await db.insert(usersTable).values({
    email: "parent1@shepherd.com",
    passwordHash: parentHash,
    firstName: "David",
    lastName: "Mensah",
    phone: "+2348067890123",
    role: "parent",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Parent 2
  const [parent2] = await db.insert(usersTable).values({
    email: "parent2@shepherd.com",
    passwordHash: parentHash,
    firstName: "Chioma",
    lastName: "Bello",
    phone: "+2348078901234",
    role: "parent",
    isActive: true,
  }).onConflictDoNothing().returning();

  // Parent 3
  const [parent3] = await db.insert(usersTable).values({
    email: "parent3@shepherd.com",
    passwordHash: parentHash,
    firstName: "Ibrahim",
    lastName: "Suleiman",
    phone: "+2348089012345",
    role: "parent",
    isActive: true,
  }).onConflictDoNothing().returning();

  console.log("Users seeded");

  // Classes
  const [toddlers] = await db.insert(classesTable).values({
    name: "Toddlers (1-3yrs)",
    ageMin: 1,
    ageMax: 3,
    capacity: 20,
    roomLocation: "Room A1",
    serviceSlot: "9am",
    description: "Nurturing class for our youngest worshippers",
  }).onConflictDoNothing().returning();

  const [beginners] = await db.insert(classesTable).values({
    name: "Beginners (4-6yrs)",
    ageMin: 4,
    ageMax: 6,
    capacity: 25,
    roomLocation: "Room A2",
    serviceSlot: "9am",
    description: "Foundation of faith for early learners",
  }).onConflictDoNothing().returning();

  const [primary] = await db.insert(classesTable).values({
    name: "Primary (7-9yrs)",
    ageMin: 7,
    ageMax: 9,
    capacity: 30,
    roomLocation: "Room B1",
    serviceSlot: "11am",
    description: "Interactive Bible stories and activities",
  }).onConflictDoNothing().returning();

  const [juniors] = await db.insert(classesTable).values({
    name: "Juniors (10-12yrs)",
    ageMin: 10,
    ageMax: 12,
    capacity: 25,
    roomLocation: "Room B2",
    serviceSlot: "11am",
    description: "Deeper engagement with scripture",
  }).onConflictDoNothing().returning();

  console.log("Classes seeded");

  // Teachers
  let teacher1: { id: number } | undefined;
  let teacher2: { id: number } | undefined;
  if (teacher1User) {
    const [t1] = await db.insert(teachersTable).values({ userId: teacher1User.id }).onConflictDoNothing().returning();
    teacher1 = t1;
  }
  if (teacher2User) {
    const [t2] = await db.insert(teachersTable).values({ userId: teacher2User.id }).onConflictDoNothing().returning();
    teacher2 = t2;
  }
  console.log("Teachers seeded");

  // Families
  if (parent1) {
    const [family1] = await db.insert(familiesTable).values({
      familyCode: "FAM-MENS01",
      parent1Id: parent1.id,
      address: "12 Broad Street, Lagos Island, Lagos",
      emergencyContactName: "Uncle Kwame Mensah",
      emergencyContactPhone: "+2348090123456",
    }).onConflictDoNothing().returning();

    if (family1 && toddlers && beginners) {
      // Children for family 1
      const [child1] = await db.insert(childrenTable).values({
        familyId: family1.id,
        firstName: "Abena",
        lastName: "Mensah",
        dob: "2022-03-15",
        gender: "female",
        allergies: "Peanuts",
        medicalNotes: "Carries EpiPen",
        currentClassId: toddlers.id,
      }).onConflictDoNothing().returning();

      const [child2] = await db.insert(childrenTable).values({
        familyId: family1.id,
        firstName: "Kofi",
        lastName: "Mensah",
        dob: "2019-07-22",
        gender: "male",
        currentClassId: beginners.id,
      }).onConflictDoNothing().returning();

      if (child1 && toddlers) {
        await db.insert(classAssignmentsTable).values({
          childId: child1.id,
          classId: toddlers.id,
          assignedBy: admin?.id,
          status: "active",
        }).onConflictDoNothing();
      }
      if (child2 && beginners) {
        await db.insert(classAssignmentsTable).values({
          childId: child2.id,
          classId: beginners.id,
          assignedBy: admin?.id,
          status: "active",
        }).onConflictDoNothing();
      }
    }
  }

  if (parent2) {
    const [family2] = await db.insert(familiesTable).values({
      familyCode: "FAM-BELL01",
      parent1Id: parent2.id,
      address: "45 Victoria Island, Lagos",
      emergencyContactName: "Aunty Ngozi",
      emergencyContactPhone: "+2348091234567",
    }).onConflictDoNothing().returning();

    if (family2 && primary && juniors) {
      const [child3] = await db.insert(childrenTable).values({
        familyId: family2.id,
        firstName: "Tolu",
        lastName: "Bello",
        dob: "2017-11-05",
        gender: "male",
        currentClassId: primary.id,
      }).onConflictDoNothing().returning();

      const [child4] = await db.insert(childrenTable).values({
        familyId: family2.id,
        firstName: "Amaka",
        lastName: "Bello",
        dob: "2014-02-14",
        gender: "female",
        currentClassId: juniors.id,
      }).onConflictDoNothing().returning();
    }
  }

  if (parent3) {
    const [family3] = await db.insert(familiesTable).values({
      familyCode: "FAM-SULE01",
      parent1Id: parent3.id,
      address: "78 Abuja Gardens, FCT",
      emergencyContactName: "Dr. Aminu Suleiman",
      emergencyContactPhone: "+2348092345678",
    }).onConflictDoNothing().returning();

    if (family3 && toddlers) {
      await db.insert(childrenTable).values({
        familyId: family3.id,
        firstName: "Halima",
        lastName: "Suleiman",
        dob: "2023-06-20",
        gender: "female",
        currentClassId: toddlers.id,
      }).onConflictDoNothing();
    }
  }

  console.log("Families and children seeded");

  // Seed some notifications for parent1
  if (parent1) {
    await db.insert(notificationsTable).values([
      {
        userId: parent1.id,
        type: "check_in",
        title: "Child Checked In",
        message: "Abena has been safely checked into Toddlers class.",
        channel: "in_app",
        readStatus: false,
      },
      {
        userId: parent1.id,
        type: "appraisal",
        title: "Weekly Appraisal Ready",
        message: "Kofi's weekly appraisal from Emmanuel is ready to view.",
        channel: "in_app",
        readStatus: false,
      },
    ]).onConflictDoNothing();
  }

  console.log("Notifications seeded");

  console.log("\n=== SEED COMPLETE ===");
  console.log("Demo accounts:");
  console.log("  Super Admin: superadmin@shepherd.com / admin123");
  console.log("  Admin:       admin@shepherd.com / admin123");
  console.log("  Teacher:     teacher1@shepherd.com / teacher123");
  console.log("  Attendant:   attendant@shepherd.com / attend123");
  console.log("  Parent:      parent1@shepherd.com / parent123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
