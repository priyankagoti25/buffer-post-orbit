import { Router } from "express";
import authRoutes from "./auth.routes";
import bufferRoutes from "./buffer.routes";
const router = Router();
router.use("/auth", authRoutes);
router.use("/buffer", bufferRoutes);

export default router;
