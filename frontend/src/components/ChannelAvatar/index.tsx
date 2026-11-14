import { useState } from 'react';
import { getService } from '../../lib/channels';

type Props = { src?: string | null; name: string; service: string; size?: number };

/** Channel picture with a small coloured dot for the network. Falls back to initials. */
export default function ChannelAvatar({ src, name, service, size = 40 }: Props) {
  const [broken, setBroken] = useState(false);
  const info = getService(service);
  const initials = name.trim().slice(0, 2).toUpperCase() || '?';
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {src && !broken ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full bg-mist-200 text-xs font-semibold text-forest-800"
          style={{ fontSize: size * 0.32 }}
        >
          {initials}
        </span>
      )}
      {service && (
        <span
          title={info.label}
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
          style={{ background: info.color }}
        />
      )}
    </span>
  );
}
