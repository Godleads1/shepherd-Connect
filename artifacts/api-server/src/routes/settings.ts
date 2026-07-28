import { Router } from "express";
import { db, churchSettingsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { eq } from "drizzle-orm";

const router = Router();

const LOCATION_DEFAULTS = {
  churchName: "RCCG City of David",
  address: "Victoria Island, Lagos",
  mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
};

const GENERAL_DEFAULTS = {
  serviceSlot1Label: "1st Service",
  serviceSlot1Time: "7:00 – 10:00 AM",
  serviceSlot2Label: "2nd Service",
  serviceSlot2Time: "10:30 AM onwards",
  supportPhone: "",
  announcementBanner: "",
};

/** Fetch the single settings row, falling back to defaults */
async function getRow() {
  try {
    const rows = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/settings/location
 * Public — parents need this without being authenticated for the collection notice.
 */
router.get("/settings/location", async (_req, res): Promise<void> => {
  const row = await getRow();
  if (!row) {
    res.json(LOCATION_DEFAULTS);
    return;
  }
  const { churchName, address, mapsUrl } = row;
  res.json({ churchName, address, mapsUrl });
});

/**
 * PUT /api/settings/location
 * Admin-only — update location settings.
 */
router.put("/settings/location", authMiddleware, requireRoles("super_admin", "admin"), async (req, res): Promise<void> => {
  const { churchName, address, mapsUrl } = req.body as {
    churchName?: string;
    address?: string;
    mapsUrl?: string;
  };

  const existing = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));

  if (existing.length === 0) {
    await db.insert(churchSettingsTable).values({
      id: 1,
      churchName: churchName ?? LOCATION_DEFAULTS.churchName,
      address: address ?? LOCATION_DEFAULTS.address,
      mapsUrl: mapsUrl ?? LOCATION_DEFAULTS.mapsUrl,
      updatedAt: new Date(),
    } as any);
  } else {
    await db.update(churchSettingsTable)
      .set({
        ...(churchName !== undefined && { churchName }),
        ...(address !== undefined && { address }),
        ...(mapsUrl !== undefined && { mapsUrl }),
        updatedAt: new Date(),
      })
      .where(eq(churchSettingsTable.id, 1));
  }

  const updated = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
  res.json(updated[0]);
});

/**
 * GET /api/settings/general
 * Public — the check-in page and parent dashboard need this unauthenticated.
 */
router.get("/settings/general", async (_req, res): Promise<void> => {
  const row = await getRow();
  if (!row) {
    res.json(GENERAL_DEFAULTS);
    return;
  }
  res.json({
    serviceSlot1Label: row.serviceSlot1Label ?? GENERAL_DEFAULTS.serviceSlot1Label,
    serviceSlot1Time:  row.serviceSlot1Time  ?? GENERAL_DEFAULTS.serviceSlot1Time,
    serviceSlot2Label: row.serviceSlot2Label ?? GENERAL_DEFAULTS.serviceSlot2Label,
    serviceSlot2Time:  row.serviceSlot2Time  ?? GENERAL_DEFAULTS.serviceSlot2Time,
    supportPhone:      row.supportPhone      ?? GENERAL_DEFAULTS.supportPhone,
    announcementBanner: row.announcementBanner ?? GENERAL_DEFAULTS.announcementBanner,
  });
});

/**
 * PUT /api/settings/general
 * Super-admin only — update general church-wide settings.
 */
router.put(
  "/settings/general",
  authMiddleware,
  requireRoles("super_admin"),
  async (req, res): Promise<void> => {
    const {
      serviceSlot1Label,
      serviceSlot1Time,
      serviceSlot2Label,
      serviceSlot2Time,
      supportPhone,
      announcementBanner,
    } = req.body as Partial<typeof GENERAL_DEFAULTS>;

    const existing = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));

    if (existing.length === 0) {
      await db.insert(churchSettingsTable).values({
        id: 1,
        ...LOCATION_DEFAULTS,
        serviceSlot1Label: serviceSlot1Label ?? GENERAL_DEFAULTS.serviceSlot1Label,
        serviceSlot1Time:  serviceSlot1Time  ?? GENERAL_DEFAULTS.serviceSlot1Time,
        serviceSlot2Label: serviceSlot2Label ?? GENERAL_DEFAULTS.serviceSlot2Label,
        serviceSlot2Time:  serviceSlot2Time  ?? GENERAL_DEFAULTS.serviceSlot2Time,
        supportPhone:      supportPhone      ?? GENERAL_DEFAULTS.supportPhone,
        announcementBanner: announcementBanner ?? GENERAL_DEFAULTS.announcementBanner,
        updatedAt: new Date(),
      } as any);
    } else {
      await db.update(churchSettingsTable)
        .set({
          ...(serviceSlot1Label !== undefined && { serviceSlot1Label }),
          ...(serviceSlot1Time  !== undefined && { serviceSlot1Time }),
          ...(serviceSlot2Label !== undefined && { serviceSlot2Label }),
          ...(serviceSlot2Time  !== undefined && { serviceSlot2Time }),
          ...(supportPhone      !== undefined && { supportPhone }),
          ...(announcementBanner !== undefined && { announcementBanner }),
          updatedAt: new Date(),
        })
        .where(eq(churchSettingsTable.id, 1));
    }

    const updated = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
    res.json({
      serviceSlot1Label: updated[0].serviceSlot1Label,
      serviceSlot1Time:  updated[0].serviceSlot1Time,
      serviceSlot2Label: updated[0].serviceSlot2Label,
      serviceSlot2Time:  updated[0].serviceSlot2Time,
      supportPhone:      updated[0].supportPhone,
      announcementBanner: updated[0].announcementBanner,
    });
  },
);

export default router;
