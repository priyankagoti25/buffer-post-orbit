import { getService } from "../../lib/channels";
import type { Channel, TargetOptions } from "../../types/buffer";
import ChannelAvatar from "../ChannelAvatar";

const YT_CATEGORIES: [string, string][] = [
  ["22", "People & Blogs"],
  ["27", "Education"],
  ["28", "Science & Technology"],
  ["24", "Entertainment"],
  ["26", "How-to & Style"],
  ["10", "Music"],
  ["20", "Gaming"],
  ["23", "Comedy"],
  ["25", "News & Politics"],
  ["17", "Sports"],
  ["1", "Film & Animation"],
  ["15", "Pets & Animals"],
  ["2", "Autos & Vehicles"],
];

/** Which networks have extra settings worth showing. */
export const needsSettings = (service: string) =>
  ["instagram", "facebook", "youtube", "pinterest", "tiktok"].includes(
    getService(service).key,
  );

type Props = {
  channels: Channel[];
  options: Record<string, TargetOptions>;
  onChange: (channelId: string, patch: TargetOptions) => void;
  hasVideo: boolean;
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <div className="mt-1 text-sm text-ink">{children}</div>
    </label>
  );
}

export default function TargetSettings({
  channels,
  options,
  onChange,
  hasVideo,
}: Props) {
  const list = channels.filter((c) => needsSettings(c.service));
  if (!list.length) return null;

  return (
    <div className="space-y-3">
      {list.map((c) => {
        const key = getService(c.service).key;
        const o = options[c.id] ?? {};
        const set = (p: TargetOptions) => onChange(c.id, p);
        return (
          <fieldset
            key={c.id}
            className="rounded-2xl border border-line bg-paper p-4"
          >
            <legend className="sr-only">
              {c.displayName || c.name} settings
            </legend>
            <div className="mb-3 flex items-center gap-2.5">
              <ChannelAvatar
                src={c.avatar}
                name={c.displayName || c.name}
                service={c.service}
                size={26}
              />
              <span className="text-sm font-medium">
                {getService(c.service).label} · {c.displayName || c.name}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {key === "instagram" && (
                <>
                  <Row label="Post type">
                    <select
                      className="field mt-0"
                      value={o.instagramType ?? ""}
                      onChange={(e) =>
                        set({
                          instagramType: (e.target.value ||
                            undefined) as TargetOptions["instagramType"],
                        })
                      }
                    >
                      <option value="">
                        Automatic ({hasVideo ? "Reel" : "Post"})
                      </option>
                      <option value="post">Post</option>
                      <option value="reel">Reel</option>
                      <option value="story">Story</option>
                    </select>
                  </Row>
                  <Row label="Publishing method">
                    <select
                      className="field mt-0"
                      value={o.schedulingType ?? "automatic"}
                      onChange={(e) =>
                        set({
                          schedulingType: e.target
                            .value as TargetOptions["schedulingType"],
                        })
                      }
                    >
                      <option value="automatic">Automatic</option>
                      <option value="notification">
                        Reminder (I post by hand)
                      </option>
                    </select>
                    <span className="mt-1 block text-xs text-muted">
                      Instagram personal profiles can only use reminders. Buffer
                      sends you a notification and you publish it yourself.
                    </span>
                  </Row>
                  <Row label="Reels">
                    <label className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        className="accent-[#17261d]"
                        checked={o.shareToFeed ?? true}
                        onChange={(e) => set({ shareToFeed: e.target.checked })}
                      />{" "}
                      Also show on the feed
                    </label>
                  </Row>
                </>
              )}
              {key === "facebook" && (
                <Row label="Post type">
                  <select
                    className="field mt-0"
                    value={o.facebookType ?? "post"}
                    onChange={(e) =>
                      set({
                        facebookType: e.target
                          .value as TargetOptions["facebookType"],
                      })
                    }
                  >
                    <option value="post">Post</option>
                    <option value="reel">Reel</option>
                    <option value="story">Story</option>
                  </select>
                </Row>
              )}
              {key === "youtube" && (
                <>
                  <Row label="Title (max 100)">
                    <input
                      className="field mt-0"
                      maxLength={100}
                      value={o.title ?? ""}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Uses the first line of your text if empty"
                    />
                  </Row>
                  <Row label="Category">
                    <select
                      className="field mt-0"
                      value={o.categoryId ?? "22"}
                      onChange={(e) => set({ categoryId: e.target.value })}
                    >
                      {YT_CATEGORIES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </Row>
                  <Row label="Who can watch">
                    <select
                      className="field mt-0"
                      value={o.privacy ?? "public"}
                      onChange={(e) =>
                        set({
                          privacy: e.target.value as TargetOptions["privacy"],
                        })
                      }
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </Row>
                  <Row label="Audience">
                    <label className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        className="accent-[#17261d]"
                        checked={o.madeForKids ?? false}
                        onChange={(e) => set({ madeForKids: e.target.checked })}
                      />{" "}
                      Made for kids
                    </label>
                  </Row>
                </>
              )}
              {key === "pinterest" && (
                <>
                  <Row label="Board ID (required)">
                    <input
                      className="field mt-0"
                      value={o.boardServiceId ?? ""}
                      onChange={(e) =>
                        set({ boardServiceId: e.target.value.trim() })
                      }
                      placeholder="Pinterest board ID"
                    />
                  </Row>
                  <Row label="Pin title (max 100)">
                    <input
                      className="field mt-0"
                      maxLength={100}
                      value={o.title ?? ""}
                      onChange={(e) => set({ title: e.target.value })}
                    />
                  </Row>
                  <div className="sm:col-span-2">
                    <Row label="Link (optional)">
                      <input
                        className="field mt-0"
                        type="url"
                        value={o.pinUrl ?? ""}
                        onChange={(e) =>
                          set({ pinUrl: e.target.value || undefined })
                        }
                        placeholder="https://…"
                      />
                    </Row>
                    <p className="mt-1 text-xs text-muted">
                      Buffer's API needs the board's ID. Find it in Buffer
                      Explorer by querying this channel's details.
                    </p>
                  </div>
                </>
              )}
              {key === "tiktok" && !hasVideo && (
                <Row label="Photo post title">
                  <input
                    className="field mt-0"
                    maxLength={90}
                    value={o.title ?? ""}
                    onChange={(e) => set({ title: e.target.value })}
                  />
                </Row>
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
