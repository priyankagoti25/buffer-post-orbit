import { getService } from "../../lib/channels";
import type { Channel, Organization } from "../../types/buffer";
import ChannelAvatar from "../ChannelAvatar";

/** Why a channel cannot be chosen, or null when it can. */
export function channelBlockedReason(c: Channel): string | null {
  if (c.isDisconnected) return "Disconnected. Reconnect it in Buffer first.";
  if (c.isLocked) return "Locked on your Buffer plan.";
  return null;
}

type Props = {
  organizations: Organization[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Only one channel can be picked (used when editing a post). */
  single?: boolean;
  /** Channels that cannot be chosen in addition to the usual rules. */
  lockedTo?: string;
};

export default function ChannelPicker({
  organizations,
  value,
  onChange,
  single = false,
  lockedTo,
}: Props) {
  const toggle = (id: string) => {
    if (single) return onChange([id]);
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  };

  return (
    <div className="space-y-4">
      {organizations.map((org) => (
        <div key={org.id}>
          {organizations.length > 1 && (
            <p className="mb-2 text-xs font-medium text-muted">{org.name}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {org.channels.map((c) => {
              const reason =
                channelBlockedReason(c) ??
                (lockedTo && lockedTo !== c.id
                  ? "Not available while editing."
                  : null);
              const info = getService(c.service);
              const selected = value.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={Boolean(reason)}
                  aria-pressed={selected}
                  title={reason ?? info.note ?? info.label}
                  onClick={() => toggle(c.id)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-forest-700 bg-sage-100"
                      : "border-line bg-paper hover:bg-sage-50"
                  } ${reason ? "opacity-45" : ""}`}
                >
                  <ChannelAvatar
                    src={c.avatar}
                    name={c.displayName || c.name}
                    service={c.service}
                    size={30}
                  />
                  <span className="min-w-0">
                    <span className="block max-w-[10rem] truncate font-medium">
                      {c.displayName || c.name}
                    </span>
                    <span className="block text-xs font-medium text-muted">
                      {info.label}
                      {info.compose === "experimental" && " · experimental"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
