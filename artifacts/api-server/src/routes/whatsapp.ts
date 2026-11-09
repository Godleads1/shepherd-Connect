import { Router } from "express";
import { z } from "zod/v4";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import {
  getWhatsAppState,
  connectWhatsApp,
  connectWithPhone,
  disconnectWhatsApp,
  WhatsAppNotLeaderError,
} from "../services/whatsapp";

function sendNotLeader(res: import("express").Response, err: unknown): boolean {
  if (!(err instanceof WhatsAppNotLeaderError)) return false;
  res.status(409).json({ error: "Conflict", message: err.message });
  return true;
}

const router = Router();

router.get(
  "/whatsapp/status",
  authMiddleware,
  requireRoles("super_admin"),
  async (_req, res): Promise<void> => {
    res.json(getWhatsAppState());
  },
);

router.post(
  "/whatsapp/connect",
  authMiddleware,
  requireRoles("super_admin"),
  async (req, res): Promise<void> => {
    const body = z.object({ phone: z.string().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid body" }); return; }

    try {
      if (body.data.phone) {
        await connectWithPhone(body.data.phone);
        res.json({ success: true, mode: "phone", message: "Requesting pairing code — check status" });
      } else {
        await connectWhatsApp();
        res.json({ success: true, mode: "qr", message: "QR code generating — check status" });
      }
    } catch (err) {
      if (!sendNotLeader(res, err)) throw err;
    }
  },
);

router.delete(
  "/whatsapp/session",
  authMiddleware,
  requireRoles("super_admin"),
  async (_req, res): Promise<void> => {
    try {
      await disconnectWhatsApp();
      res.json({ success: true, message: "WhatsApp session cleared" });
    } catch (err) {
      if (!sendNotLeader(res, err)) throw err;
    }
  },
);

export default router;
