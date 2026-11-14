import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  DB_NAME: z.string().min(1),
  // A trailing slash would break the origin check, so it is removed.
  CLIENT_URL: z
    .string()
    .url()
    .transform((u) => u.replace(/\/+$/, "")),
  JWT_SECRET: z.string().min(16, "JWT_SECRET should be at least 16 characters"),
  BUFFER_CLIENT_ID: z.string().default(""),
  BUFFER_CLIENT_SECRET: z.string().default(""),
  BUFFER_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/buffer/callback"),
  BUFFER_SCOPES: z
    .string()
    .default(
      "account:read posts:read posts:write ideas:read ideas:write offline_access",
    ),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .default("")
    .refine(
      (v) => v === "" || /^[0-9a-fA-F]{64}$/.test(v),
      "TOKEN_ENCRYPTION_KEY must be 64 hex characters (run: npm run gen-key)",
    ),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  CLOUDINARY_FOLDER: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/)
    .default("buffer-connect"),
  // AI writing helper. Get a free key at https://aistudio.google.com/apikey
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-flash-lite-latest"),
  AI_MESSAGES_PER_HOUR: z.coerce.number().int().min(1).default(20),
  AI_MESSAGES_PER_DAY: z.coerce.number().int().min(1).default(300),
  // Set to false on a second copy of the server so only one process runs the recurring-post worker.
  RECURRING_WORKER: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  ENABLE_DEV_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
