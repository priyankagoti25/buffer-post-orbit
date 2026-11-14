import { workerStatus } from "./workers/recurring.worker";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler.middleware";
import bufferRoutes from "./routes/buffer.routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // hosts such as Render sit behind a proxy
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) =>
    res.json({ ok: true, recurringWorker: workerStatus }),
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/buffer", bufferRoutes);

  app.use(errorHandler);
  return app;
}
