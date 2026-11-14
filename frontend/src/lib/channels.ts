export type ServiceInfo = {
  key: string;
  label: string;
  color: string;
  /** Character limit, or null when we are not sure. */
  limit: number | null;
  /** experimental = we could not test this network with Buffer's API. */
  compose: "ok" | "experimental";
  /** none = no media; optional; required = a post needs media; video = needs a video. */
  media: "none" | "optional" | "required" | "video";
  maxMedia?: number;
  note?: string;
};

const SERVICES: Record<string, Omit<ServiceInfo, "key">> = {
  twitter: {
    label: "X",
    color: "#111111",
    limit: 280,
    compose: "ok",
    media: "optional",
    maxMedia: 4,
    note: "280 for free accounts. Premium accounts can write more, so this limit is only a warning.",
  },
  linkedin: {
    label: "LinkedIn",
    color: "#0a66c2",
    limit: 3000,
    compose: "ok",
    media: "optional",
  },
  facebook: {
    label: "Facebook",
    color: "#1877f2",
    limit: 5000,
    compose: "ok",
    media: "optional",
  },
  threads: {
    label: "Threads",
    color: "#222222",
    limit: 500,
    compose: "ok",
    media: "optional",
  },
  bluesky: {
    label: "Bluesky",
    color: "#1185fe",
    limit: 300,
    compose: "ok",
    media: "optional",
    maxMedia: 4,
  },
  mastodon: {
    label: "Mastodon",
    color: "#6364ff",
    limit: 500,
    compose: "ok",
    media: "optional",
    maxMedia: 4,
    note: "500 is the common default. Your server may differ.",
  },
  googlebusiness: {
    label: "Google Business",
    color: "#34a853",
    limit: 4000,
    compose: "experimental",
    media: "optional",
    maxMedia: 1,
    note: "Untested here. Buffer wants extra details for some post types.",
  },
  substack: {
    label: "Substack",
    color: "#ff6719",
    limit: 10000,
    compose: "experimental",
    media: "optional",
    note: "Untested here. Mentions are not supported on Substack.",
  },
  instagram: {
    label: "Instagram",
    color: "#e1306c",
    limit: 2196,
    compose: "ok",
    media: "required",
    maxMedia: 10,
    note: "Instagram needs an image or video.",
  },
  pinterest: {
    label: "Pinterest",
    color: "#e60023",
    limit: 500,
    compose: "ok",
    media: "required",
    maxMedia: 1,
    note: "Pinterest needs an image or video and a board ID.",
  },
  tiktok: {
    label: "TikTok",
    color: "#010101",
    limit: 4000,
    compose: "ok",
    media: "optional",
    note: "TikTok works best with a video. Captions are limited to 2200 characters with a video.",
  },
  youtube: {
    label: "YouTube",
    color: "#ff0000",
    limit: 5000,
    compose: "ok",
    media: "video",
    maxMedia: 1,
    note: "YouTube needs a video and a title.",
  },
};

/** Turn whatever Buffer calls the service into one of our keys. */
export function serviceKey(service: string | null | undefined): string {
  const s = String(service ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (s === "x") return "twitter";
  if (s.startsWith("google")) return "googlebusiness";
  return s;
}

export function getService(service: string | null | undefined): ServiceInfo {
  const key = serviceKey(service);
  const known = SERVICES[key];
  if (known) return { key, ...known };
  return {
    key,
    label: service ? String(service) : "Unknown",
    color: "#5f6f65",
    limit: null,
    compose: "experimental",
    media: "optional",
    note: "This network has not been tested in this app.",
  };
}

/** The character limit that applies right now (TikTok drops to 2200 when a video is attached). */
export function limitFor(info: ServiceInfo, hasVideo: boolean): number | null {
  return info.key === "tiktok" && hasVideo ? 2200 : info.limit;
}

type MediaLike = { kind: "image" | "video" };
type OptionsLike = { boardServiceId?: string; title?: string };

/** Things that would make Buffer refuse this post on this network. Shown before sending. */
export function problemsFor(
  service: string,
  media: MediaLike[],
  options: OptionsLike,
): string[] {
  const info = getService(service);
  const out: string[] = [];
  const hasVideo = media.some((m) => m.kind === "video");
  if (info.media === "required" && media.length === 0)
    out.push(`${info.label} needs an image or video.`);
  if (info.media === "video" && !hasVideo)
    out.push(`${info.label} needs a video.`);
  if (info.maxMedia && media.length > info.maxMedia)
    out.push(
      `${info.label} allows at most ${info.maxMedia} file${info.maxMedia === 1 ? "" : "s"}.`,
    );
  if (info.key === "pinterest" && !options.boardServiceId)
    out.push("Pinterest needs a board ID.");
  return out;
}
