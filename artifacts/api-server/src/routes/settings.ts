import { Router } from "express";
import { db, churchSettingsTable } from "@workspace/db";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULTS = {
  churchName: "RCCG City of David",
  address: "Victoria Island, Lagos",
  mapsUrl: "https://maps.app.goo.gl/uvgtpVETsCeqkzmDA",
};

/**
 * GET /api/settings/location
 * Public — parents need this without being authenticated for the collection notice.
 */
router.get("/settings/location", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(churchSettingsTable).where(eq(churchSettingsTable.id, 1));
    if (rows.length === 0) {
      res.json(DEFAULTS);
      return;
    }
    const { churchName, address, mapsUrl } = rows[0];
    res.json({ churchName, address, mapsUrl });
  } catch {
    // Fall back to defaults if the table doesn't exist yet
    res.json(DEFAULTS);
  }
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
      churchName: churchName ?? DEFAULTS.churchName,
      address: address ?? DEFAULTS.address,
      mapsUrl: mapsUrl ?? DEFAULTS.mapsUrl,
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

export default router;
