import crypto from "node:crypto";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

const FORMATS = {
  image: "jpg,jpeg,png,gif,webp",
  video: "mp4,mov,m4v",
} as const;

/**
 * The browser uploads straight to Cloudinary, so large videos never pass through this server.
 * We only hand out a short-lived signature that is tied to one folder per user.
 * Files are stored as normal public uploads: Buffer needs plain public links, not signed ones.
 */
export function signUpload(userId: string, kind: "image" | "video") {
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    throw new AppError(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Media upload is not set up on the server (Cloudinary keys missing).",
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    allowed_formats: FORMATS[kind],
    folder: `${env.CLOUDINARY_FOLDER}/${userId}`,
    timestamp,
  };
  // Cloudinary signs "key=value&key=value" in alphabetical order, followed by the secret.
  const toSign =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&") + env.CLOUDINARY_API_SECRET;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${kind}/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    signature,
    params,
    maxBytes: kind === "image" ? 10 * 1024 * 1024 : 100 * 1024 * 1024,
  };
}
