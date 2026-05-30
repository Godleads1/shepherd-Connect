import { Router } from "express";
import { z } from "zod/v4";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import {
  getWhatsAppState,
  connectWhatsApp,
  connectWithPhone,
  disconnectWhatsApp,
} from "../services/whatsapp";

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

    if (body.data.phone) {
      await connectWithPhone(body.data.phone);
      res.json({ success: true, mode: "phone", message: "Requesting pairing code — check status" });
    } else {
      await connectWhatsApp();
      res.json({ success: true, mode: "qr", message: "QR code generating — check status" });
    }
  },
);

router.delete(
  "/whatsapp/session",
  authMiddleware,
  requireRoles("super_admin"),
  async (_req, res): Promise<void> => {
    await disconnectWhatsApp();
    res.json({ success: true, message: "WhatsApp session cleared" });
  },
);

export default router;
