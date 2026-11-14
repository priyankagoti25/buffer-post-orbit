import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.middleware";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.middleware";
import {
  bufferCallback,
  bufferStatus,
  connectBuffer,
  disconnectBuffer,
} from "../controllers/buffer.controller";
import {
  createIdea,
  deleteIdea,
  listIdeas,
  updateIdea,
} from "../controllers/ideas.controller";
import {
  cancelRecurring,
  createRecurring,
  listRecurring,
  pauseRecurring,
  resumeRecurring,
  updateRecurring,
} from "../controllers/recurring.controller";
import { aiChat } from "../controllers/ai.controller";
import { signMediaUpload } from "../controllers/media.controller";
import { getOverview } from "../controllers/overview.controller";
import {
  createPostsHandler,
  deletePostHandler,
  editPostHandler,
  getPostHandler,
  listPostsHandler,
  repostHandler,
  schedulePostHandler,
} from "../controllers/posts.controller";

const router = Router();

// Per-user limit on our own API, so one browser tab cannot burn the shared Buffer quota.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 90,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? "anonymous",
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Slow down a little and try again.",
    },
  },
});
const secured = [requireAuth, apiLimiter];

// Connection (existing)
router.post("/connect", requireTrustedOrigin, connectBuffer);
router.get("/callback", bufferCallback);
router.get("/status", requireAuth, bufferStatus);
router.delete("/connection", requireAuth, disconnectBuffer);

// Dashboard data
router.get("/overview", ...secured, getOverview);

// Posts
router.get("/posts", ...secured, listPostsHandler);
router.post("/posts", ...secured, createPostsHandler);
router.get("/posts/:id", ...secured, getPostHandler);
router.patch("/posts/:id", ...secured, editPostHandler);
router.delete("/posts/:id", ...secured, deletePostHandler);
router.post("/posts/:id/schedule", ...secured, schedulePostHandler);
router.post("/posts/:id/repost", ...secured, repostHandler);

// Recurring posts
router.get("/recurring", ...secured, listRecurring);
router.post("/recurring", ...secured, createRecurring);
router.put("/recurring/:id", ...secured, updateRecurring);
router.post("/recurring/:id/pause", ...secured, pauseRecurring);
router.post("/recurring/:id/resume", ...secured, resumeRecurring);
router.delete("/recurring/:id", ...secured, cancelRecurring);

// AI writing helper (Google Gemini)
router.post("/ai/chat", ...secured, aiChat);

// Media (signed Cloudinary uploads)
router.post("/media/sign", ...secured, signMediaUpload);

// Ideas
router.get("/ideas", ...secured, listIdeas);
router.post("/ideas", ...secured, createIdea);
router.patch("/ideas/:id", ...secured, updateIdea);
router.delete("/ideas/:id", ...secured, deleteIdea);

export default router;
