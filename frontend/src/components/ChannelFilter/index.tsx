import { useEffect, useRef, useState } from "react";
import { getService } from "../../lib/channels";
import type { Channel } from "../../types/buffer";
import ChannelAvatar from "../ChannelAvatar";
import ServiceIcon from "../ServiceIcon";
import { FaChevronDown } from "react-icons/fa";

type Props = {
  channels: Channel[];
  value: string;
  onChange: (id: string) => void;
  /** Text for the "everything" option. */
  allLabel?: string;
};

const nameOf = (c: Channel) => c.displayName || c.name;

/** A dropdown that shows each channel with its picture and network logo, so same-named channels are easy to tell apart. */
export default function ChannelFilter({
  channels,
  value,
  onChange,
  allLabel = "All channels",
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = channels.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Channel"
        onClick={() => setOpen((o) => !o)}
        className="field mt-0 flex w-auto min-w-52 items-center gap-2.5 text-left"
      >
        {current ? (
          <>
            <ChannelAvatar
              src={current.avatar}
              name={nameOf(current)}
              service=""
              size={22}
            />
            <ServiceIcon service={current.service} size={15} />
            <span className="min-w-0 flex-1 truncate">{nameOf(current)}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
        )}
        <span aria-hidden className="text-xs font-semibold text-muted">
          <FaChevronDown />
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Channel"
          className="absolute left-0 z-30 mt-1.5 max-h-80 w-72 max-w-[85vw] overflow-y-auto rounded-2xl border border-line bg-paper p-1.5 shadow-lg"
        >
          <li role="option" aria-selected={!value}>
            <button
              type="button"
              onClick={() => pick("")}
              className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm hover:bg-sage-50 ${!value ? "bg-sage-100" : ""}`}
            >
              {allLabel}
            </button>
          </li>
          {channels.map((c) => (
            <li key={c.id} role="option" aria-selected={value === c.id}>
              <button
                type="button"
                onClick={() => pick(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-sage-50 ${value === c.id ? "bg-sage-100" : ""}`}
              >
                <ChannelAvatar
                  src={c.avatar}
                  name={nameOf(c)}
                  service=""
                  size={28}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {nameOf(c)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <ServiceIcon service={c.service} size={12} />
                    {getService(c.service).label}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
