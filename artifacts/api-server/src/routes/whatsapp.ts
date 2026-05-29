import { Router } from "express";
import { authMiddleware, requireRoles } from "../middlewares/auth";
import { getWhatsAppState, initWhatsApp, disconnectWhatsApp } from "../services/whatsapp";

const router = Router();

router.get("/whatsapp/status", authMiddleware, requireRoles("super_admin"), async (_req, res): Promise<void> => {
  res.json(getWhatsAppState());
});

router.post("/whatsapp/connect", authMiddleware, requireRoles("super_admin"), async (_req, res): Promise<void> => {
  await initWhatsApp();
  res.json({ success: true, message: "WhatsApp initialising — check status for QR code" });
});

router.delete("/whatsapp/session", authMiddleware, requireRoles("super_admin"), async (_req, res): Promise<void> => {
  await disconnectWhatsApp();
  res.json({ success: true, message: "WhatsApp session cleared" });
});

export default router;
