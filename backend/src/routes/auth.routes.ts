import { Router } from "express";
import { exchangeCode, logout, refresh } from "../controllers/auth.controller";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.middleware";
// Sign-in happens only through Buffer: see POST /api/buffer/connect and GET /api/buffer/callback.
const router = Router();
// SameSite=None cookies are sent from other sites, so these only accept requests from our own frontend.
router.post("/refresh", requireTrustedOrigin, refresh);
router.post("/exchange", requireTrustedOrigin, exchangeCode);
router.post("/logout", requireTrustedOrigin, logout);
export default router;
