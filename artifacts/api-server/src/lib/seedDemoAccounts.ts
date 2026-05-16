import bcrypt from "bcryptjs";
import { db, usersTable, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const DEMO_TEACHERS = [
  { n: 3,  firstName: "Chioma",  lastName: "Obi",      phone: "+2348111111103" },
  { n: 4,  firstName: "Daniel",  lastName: "Adeyemi",  phone: "+2348111111104" },
  { n: 5,  firstName: "Faith",   lastName: "Okonkwo",  phone: "+2348111111105" },
  { n: 6,  firstName: "Gideon",  lastName: "Eze",      phone: "+2348111111106" },
  { n: 7,  firstName: "Hannah",  lastName: "Bello",    phone: "+2348111111107" },
  { n: 8,  firstName: "Isaac",   lastName: "Musa",     phone: "+2348111111108" },
  { n: 9,  firstName: "Joy",     lastName: "Afolabi",  phone: "+2348111111109" },
  { n: 10, firstName: "Kolade",  lastName: "Suleiman", phone: "+2348111111110" },
  { n: 11, firstName: "Lydia",   lastName: "Yakubu",   phone: "+2348111111111" },
  { n: 12, firstName: "Moses",   lastName: "Olawale",  phone: "+2348111111112" },
  { n: 13, firstName: "Naomi",   lastName: "Adebayo",  phone: "+2348111111113" },
];

export async function seedDemoAccounts(): Promise<void> {
  try {
    const teacherHash = await bcrypt.hash("teacher123", 12);

    for (const t of DEMO_TEACHERS) {
      const email = `teacher${t.n}@shepherd.com`;
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email));

      if (existing) continue;

      const [newUser] = await db
        .insert(usersTable)
        .values({
          email,
          passwordHash: teacherHash,
          firstName: t.firstName,
          lastName: t.lastName,
          phone: t.phone,
          role: "teacher",
          isActive: true,
          status: "active",
        })
        .returning({ id: usersTable.id });

      if (newUser) {
        await db.insert(teachersTable).values({ userId: newUser.id });
        logger.info({ email }, "Demo teacher account created");
      }
    }
  } catch (err) {
    logger.error({ err }, "seedDemoAccounts failed — skipping");
  }
}
