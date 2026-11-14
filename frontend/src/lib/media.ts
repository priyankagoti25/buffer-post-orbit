import { api } from "./api";
import type { Asset } from "../types/buffer";

export type MediaItem = {
  id: string;
  kind: "image" | "video";
  name: string;
  url: string;
  altText: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  /** Local preview while the upload runs. */
  localUrl?: string;
};

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export const kindOfFile = (f: File): "image" | "video" | null =>
  IMAGE_TYPES.includes(f.type)
    ? "image"
    : VIDEO_TYPES.includes(f.type)
      ? "video"
      : null;

/** "my_holiday-photo.JPG" becomes "my holiday photo". Used as the alt text, so nobody has to type one. */
export const altFromName = (fileName: string): string => {
  const t = fileName
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return /[a-z]/i.test(t) ? t : ""; // a name like "1234" says nothing, so skip it
};

/** Buffer ideas take still images only. Videos, GIFs and anything else must stay out of the call. */
export const isStillImage = (m: {
  kind: string;
  name?: string;
  url?: string;
}) =>
  m.kind === "image" &&
  !/\.gif(\?|#|$)/i.test(m.name || "") &&
  !/\.gif(\?|#|$)/i.test(m.url || "");

export const toAssets = (items: MediaItem[]): Asset[] =>
  items
    .filter((m) => m.status === "done")
    .map((m) => ({
      kind: m.kind,
      url: m.url,
      ...(m.altText.trim() ? { altText: m.altText.trim() } : {}),
    }));

export const fromAssets = (assets: Asset[]): MediaItem[] =>
  assets.map((a, i) => ({
    id: `a${Date.now()}${i}`,
    kind: a.kind,
    name: a.url.split("/").pop()?.slice(0, 40) ?? "media",
    url: a.url,
    altText: a.altText ?? "",
    status: "done",
    progress: 100,
  }));

/** Buffer returns asset types like "image/jpeg". */
export const assetsFromPost = (
  assets: { mimeType?: string | null; source?: string | null }[],
): Asset[] => {
  const out: Asset[] = [];
  for (const a of assets) {
    if (!a.source?.startsWith("https://")) continue;
    if (a.mimeType?.startsWith("image/"))
      out.push({ kind: "image", url: a.source });
    else if (a.mimeType?.startsWith("video/"))
      out.push({ kind: "video", url: a.source });
  }
  return out;
};

type Signature = {
  uploadUrl: string;
  apiKey: string;
  signature: string;
  params: Record<string, string | number>;
  maxBytes: number;
};

/** Ask our server for a signature, then send the file straight to Cloudinary. */
export async function uploadFile(
  file: File,
  kind: "image" | "video",
  onProgress: (pct: number) => void,
): Promise<string> {
  const { data: sig } = await api.post<Signature>("/api/buffer/media/sign", {
    kind,
  });
  if (file.size > sig.maxBytes)
    throw new Error(
      `File is too large (limit ${Math.round(sig.maxBytes / 1048576)} MB).`,
    );

  return new Promise<string>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("signature", sig.signature);
    for (const [k, v] of Object.entries(sig.params)) form.append(k, String(v));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.uploadUrl);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () =>
      reject(new Error("Upload failed. Check your connection."));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && body.secure_url)
          resolve(String(body.secure_url));
        else reject(new Error(body?.error?.message ?? "Upload was rejected."));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.send(form);
  });
}
