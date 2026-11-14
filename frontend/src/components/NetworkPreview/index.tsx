import { Fragment, useState, type ReactNode } from 'react';
import { serviceKey } from '../../lib/channels';
import type { TargetOptions } from '../../types/buffer';

export type PreviewMedia = { kind: 'image' | 'video'; src: string };

type Props = {
  service: string;
  name: string;
  avatar?: string | null;
  text: string;
  media: PreviewMedia[];
  options?: TargetOptions;
};

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
const TOKEN_RE = /(https?:\/\/[^\s]+|[@#][\p{L}\p{N}_][\p{L}\p{N}_.\-]*)/gu;

/** Text with links, @mentions and #hashtags coloured, cut off like the real network does. */
function Body({ text, limit, more = '…more', accent = '#0a66c2', placeholder = 'Your post will appear here.' }: { text: string; limit?: number; more?: string; accent?: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return <span className="opacity-50">{placeholder}</span>;
  const cut = !open && limit !== undefined && text.length > limit;
  const shown = cut ? text.slice(0, limit).trimEnd() : text;
  return (
    <span className="whitespace-pre-wrap break-words">
      {shown.split(TOKEN_RE).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ color: accent }}>{part}</span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
      {cut && (
        <>
          {'… '}
          <button type="button" onClick={() => setOpen(true)} className="opacity-60 hover:underline">{more.replace('…', '')}</button>
        </>
      )}
    </span>
  );
}

function Avatar({ src, name, size = 40, round = true }: { src?: string | null; name: string; size?: number; round?: boolean }) {
  const [broken, setBroken] = useState(false);
  const cls = round ? 'rounded-full' : 'rounded-lg';
  return src && !broken ? (
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ width: size, height: size }} className={`${cls} shrink-0 object-cover`} />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }} className={`${cls} grid shrink-0 place-items-center bg-stone-200 font-semibold text-stone-600`}>
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}

const G = {
  heart: 'M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z',
  comment: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  send: 'M22 3 11 14M22 3l-7 18-4-7-7-4z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  thumb: 'M7 11v10H3V11zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.7 20H7',
  share: 'M12 16V3M7 8l5-5 5 5M5 13v7h14v-7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  play: 'M8 5v14l11-7z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
};
function Glyph({ d, className = 'h-[1.15rem] w-[1.15rem]', fill = false }: { d: string; className?: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Frame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-2xl border text-[0.86rem] leading-[1.35rem] shadow-sm ${className}`}>{children}</div>;
}

/** Image or video in the shape the network uses. Shows a hint box when there is no media yet. */
function Media({ media, ratio = '16/10', rounded = '', hint, className = '' }: { media: PreviewMedia[]; ratio?: string; rounded?: string; hint?: string; className?: string }) {
  if (!media.length) {
    return hint ? (
      <div style={{ aspectRatio: ratio }} className={`grid place-items-center bg-stone-100 text-center text-xs text-stone-500 ${rounded} ${className}`}>
        <span className="px-6"><Glyph d={G.image} className="mx-auto mb-1 h-6 w-6" />{hint}</span>
      </div>
    ) : null;
  }
  const one = (m: PreviewMedia, style?: React.CSSProperties, cls = '') =>
    m.kind === 'image' ? (
      <img src={m.src} alt="" className={`h-full w-full object-cover ${cls}`} style={style} />
    ) : (
      <video src={`${m.src}#t=0.1`} muted playsInline preload="metadata" className={`h-full w-full object-cover ${cls}`} style={style} />
    );
  if (media.length === 1) {
    return <div style={{ aspectRatio: ratio }} className={`overflow-hidden bg-stone-100 ${rounded} ${className}`}>{one(media[0])}</div>;
  }
  const shown = media.slice(0, 4);
  return (
    <div style={{ aspectRatio: ratio }} className={`grid gap-0.5 overflow-hidden bg-stone-100 ${shown.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'} ${rounded} ${className}`}>
      {shown.map((m, i) => (
        <div key={i} className={`relative overflow-hidden ${shown.length === 3 && i === 0 ? 'row-span-2' : ''}`}>
          {one(m)}
          {i === 3 && media.length > 4 && <span className="absolute inset-0 grid place-items-center bg-black/50 text-lg font-semibold text-white">+{media.length - 4}</span>}
        </div>
      ))}
    </div>
  );
}

const handleOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'yourname';
const firstLine = (t: string) => t.split('\n').find((l) => l.trim())?.trim() ?? '';

// ---------------------------------------------------------------------------
// One layout per network (generic icons and colours, no logos)
// ---------------------------------------------------------------------------
function LinkedIn({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#e0dfdc] bg-white text-[#191919]">
      <div className="flex gap-2.5 p-3">
        <Avatar src={avatar} name={name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-[#666]">1,234 followers</p>
          <p className="flex items-center gap-1 text-xs text-[#666]">Now · <Glyph d={G.globe} className="h-3 w-3" /></p>
        </div>
      </div>
      <div className="px-3 pb-3"><Body text={text} limit={210} more="…see more" accent="#0a66c2" /></div>
      <Media media={media} ratio={media.length === 1 ? '1.91/1' : '4/3'} />
      <div className="flex justify-between border-t border-[#e0dfdc] px-2 py-1 text-xs font-semibold text-[#666]">
        {[['Like', G.thumb], ['Comment', G.comment], ['Repost', G.repeat], ['Send', G.send]].map(([l, d]) => (
          <span key={l} className="flex items-center gap-1.5 rounded px-2 py-2"><Glyph d={d} />{l}</span>
        ))}
      </div>
    </Frame>
  );
}

function Instagram({ name, avatar, text, media, options }: Props) {
  const handle = handleOf(name);
  const story = options?.instagramType === 'story';
  return (
    <Frame className="border-[#dbdbdb] bg-white text-[#262626]">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-[2px]"><span className="block rounded-full bg-white p-[2px]"><Avatar src={avatar} name={name} size={30} /></span></span>
        <span className="flex-1 font-semibold">{handle}</span>
        <Glyph d={G.more} />
      </div>
      <div className="relative">
        <Media media={media.slice(0, 1)} ratio={story ? '9/16' : options?.instagramType === 'reel' ? '4/5' : '1/1'} hint="Instagram needs an image or video" />
        {media.length > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">1/{media.length}</span>}
        {media[0]?.kind === 'video' && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">Reel</span>}
      </div>
      <div className="flex items-center gap-3.5 px-3 pt-2.5"><Glyph d={G.heart} className="h-6 w-6" /><Glyph d={G.comment} className="h-6 w-6" /><Glyph d={G.send} className="h-6 w-6" /><span className="flex-1" /><Glyph d={G.bookmark} className="h-6 w-6" /></div>
      <p className="px-3 pt-1.5 font-semibold">0 likes</p>
      <p className="px-3 pb-3 pt-0.5"><span className="font-semibold">{handle} </span><Body text={text} limit={125} more="…more" accent="#00376b" placeholder="Write a caption…" /></p>
    </Frame>
  );
}

function XPost({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#eff3f4] bg-white text-[#0f1419]">
      <div className="flex gap-3 p-3">
        <Avatar src={avatar} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate"><span className="font-bold">{name}</span> <span className="text-[#536471]">@{handleOf(name)} · now</span></p>
          <p className="mt-0.5 text-[0.95rem]"><Body text={text} accent="#1d9bf0" /></p>
          <Media media={media} ratio={media.length === 1 ? '16/9' : '16/9'} rounded="mt-3 rounded-2xl border border-[#eff3f4]" />
          <div className="mt-3 flex max-w-xs justify-between text-[#536471]"><Glyph d={G.comment} /><Glyph d={G.repeat} /><Glyph d={G.heart} /><Glyph d={G.share} /></div>
        </div>
      </div>
    </Frame>
  );
}

function Threads({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#e6e6e6] bg-white text-[#101010]">
      <div className="flex gap-3 p-3">
        <div className="flex flex-col items-center"><Avatar src={avatar} name={name} size={36} /><span className="mt-2 w-px flex-1 bg-[#e0e0e0]" /></div>
        <div className="min-w-0 flex-1 pb-1">
          <p className="flex justify-between"><span className="font-semibold">{handleOf(name)}</span><span className="text-[#999]">now</span></p>
          <p className="mt-0.5"><Body text={text} accent="#101010" /></p>
          <Media media={media} ratio="4/5" rounded="mt-2.5 rounded-xl" />
          <div className="mt-3 flex gap-4 text-[#101010]"><Glyph d={G.heart} /><Glyph d={G.comment} /><Glyph d={G.repeat} /><Glyph d={G.send} /></div>
        </div>
      </div>
    </Frame>
  );
}

function Bluesky({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#d4dbe2] bg-white text-[#0b0f14]">
      <div className="flex gap-3 p-3">
        <Avatar src={avatar} name={name} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate"><span className="font-bold">{name}</span> <span className="text-[#667b99]">@{handleOf(name)}.bsky.social · now</span></p>
          <p className="mt-0.5 text-[0.95rem]"><Body text={text} accent="#0085ff" /></p>
          <Media media={media} ratio="16/9" rounded="mt-2.5 rounded-xl border border-[#d4dbe2]" />
          <div className="mt-3 flex max-w-xs justify-between text-[#667b99]"><Glyph d={G.comment} /><Glyph d={G.repeat} /><Glyph d={G.heart} /><Glyph d={G.more} /></div>
        </div>
      </div>
    </Frame>
  );
}

function Mastodon({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#393f4f] bg-[#282c37] text-[#d9e1e8]">
      <div className="flex items-center gap-3 p-3">
        <Avatar src={avatar} name={name} size={42} round={false} />
        <div className="min-w-0"><p className="truncate font-semibold text-white">{name}</p><p className="truncate text-[#9baec8]">@{handleOf(name)}@mastodon.social</p></div>
      </div>
      <div className="px-3 pb-3 text-[0.95rem]"><Body text={text} accent="#8c8dff" /></div>
      <Media media={media} ratio="16/9" rounded="mx-3 mb-3 rounded-lg" />
      <div className="flex gap-6 border-t border-[#393f4f] px-3 py-2 text-[#9baec8]"><Glyph d={G.comment} /><Glyph d={G.repeat} /><Glyph d={G.heart} /><Glyph d={G.bookmark} /></div>
    </Frame>
  );
}

function Facebook({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#ced0d4] bg-white text-[#050505]">
      <div className="flex items-center gap-2.5 p-3">
        <Avatar src={avatar} name={name} size={40} />
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><p className="flex items-center gap-1 text-xs text-[#65676b]">Just now · <Glyph d={G.globe} className="h-3 w-3" /></p></div>
        <Glyph d={G.more} className="text-[#65676b]" />
      </div>
      <div className="px-3 pb-3 text-[0.95rem]"><Body text={text} limit={400} more="See more" accent="#0866ff" /></div>
      <Media media={media} ratio={media.length === 1 ? '4/3' : '1/1'} />
      <div className="mx-3 flex justify-around border-t border-[#ced0d4] py-1 text-sm font-semibold text-[#65676b]">
        {[['Like', G.thumb], ['Comment', G.comment], ['Share', G.share]].map(([l, d]) => (
          <span key={l} className="flex items-center gap-1.5 py-2"><Glyph d={d} />{l}</span>
        ))}
      </div>
    </Frame>
  );
}

function Substack({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#e6e6e6] bg-white text-[#1a1a1a]">
      <div className="flex gap-3 p-4">
        <Avatar src={avatar} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2"><span className="font-semibold">{name}</span><span className="text-[#757575]">now</span></p>
          <p className="mt-1 text-[0.95rem] leading-6"><Body text={text} limit={520} more="…more" accent="#ff6719" /></p>
          <Media media={media} ratio="16/10" rounded="mt-3 rounded-lg border border-[#e6e6e6]" />
          <div className="mt-3 flex gap-6 text-[#757575]"><span className="flex items-center gap-1.5"><Glyph d={G.heart} />Like</span><span className="flex items-center gap-1.5"><Glyph d={G.comment} />Reply</span><span className="flex items-center gap-1.5"><Glyph d={G.repeat} />Restack</span><Glyph d={G.share} /></div>
        </div>
      </div>
      <div className="border-t border-[#f0f0f0] bg-[#fafafa] px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[#ff6719]">Note</div>
    </Frame>
  );
}

function Pinterest({ name, avatar, text, media, options }: Props) {
  const title = options?.title || firstLine(text) || 'Your pin title';
  return (
    <Frame className="mx-auto max-w-[17rem] border-transparent bg-transparent shadow-none">
      <Media media={media.slice(0, 1)} ratio="2/3" rounded="rounded-2xl" hint="Pinterest needs an image or video" />
      <p className="px-1 pt-2 font-semibold text-[#111]">{title.slice(0, 100)}</p>
      <p className="flex items-center gap-1.5 px-1 pt-1 text-xs text-[#5f5f5f]"><Avatar src={avatar} name={name} size={20} />{name}</p>
    </Frame>
  );
}

function TikTok({ name, text, media }: Props) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[16rem] overflow-hidden rounded-[1.4rem] bg-black text-white shadow-md">
      <div className="absolute inset-0">
        {media[0] ? (media[0].kind === 'video' ? <video src={`${media[0].src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={media[0].src} alt="" className="h-full w-full object-cover" />) : <div className="grid h-full place-items-center bg-[#161823] px-6 text-center text-xs text-white/60">TikTok works best with a video</div>}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-16">
        <p className="font-semibold">@{handleOf(name)}</p>
        <p className="mt-1 text-[0.8rem] leading-4"><Body text={text} limit={100} more="more" accent="#fff" placeholder="Your caption" /></p>
        <p className="mt-2 flex items-center gap-1.5 text-xs"><Glyph d={G.music} className="h-3.5 w-3.5" />Original sound</p>
      </div>
      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4"><Glyph d={G.heart} className="h-7 w-7" /><Glyph d={G.comment} className="h-7 w-7" /><Glyph d={G.bookmark} className="h-7 w-7" /><Glyph d={G.share} className="h-7 w-7" /></div>
    </div>
  );
}

function YouTube({ name, avatar, text, media, options }: Props) {
  const title = (options?.title || firstLine(text) || 'Your video title').slice(0, 100);
  const video = media.find((m) => m.kind === 'video');
  return (
    <Frame className="border-transparent bg-white shadow-none text-[#0f0f0f]">
      <div className="relative">
        <Media media={video ? [video] : []} ratio="16/9" rounded="rounded-xl" hint="YouTube needs a video" />
        {video && <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white"><Glyph d={G.play} fill className="h-6 w-6" /></span></span>}
      </div>
      <div className="flex gap-3 px-1 pt-3">
        <Avatar src={avatar} name={name} size={36} />
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold leading-5">{title}</p>
          <p className="text-xs text-[#606060]">{name} · 0 views · Just now{options?.privacy && options.privacy !== 'public' ? ` · ${options.privacy}` : ''}</p>
          <p className="mt-1.5 line-clamp-2 text-xs text-[#606060]"><Body text={text} accent="#065fd4" placeholder="Description" /></p>
        </div>
      </div>
    </Frame>
  );
}

function GoogleBusiness({ name, avatar, text, media }: Props) {
  return (
    <Frame className="border-[#dadce0] bg-white text-[#202124]">
      <div className="flex items-center gap-2.5 p-3"><Avatar src={avatar} name={name} size={36} /><div><p className="font-semibold">{name}</p><p className="text-xs text-[#5f6368]">Update · Just now</p></div></div>
      <Media media={media.slice(0, 1)} ratio="4/3" />
      <div className="p-3 text-[0.9rem]"><Body text={text} limit={150} more="More" accent="#1a73e8" /></div>
      <div className="px-3 pb-3"><span className="inline-block rounded-full border border-[#dadce0] px-4 py-1.5 text-sm font-medium text-[#1a73e8]">Learn more</span></div>
    </Frame>
  );
}

const LAYOUTS: Record<string, (p: Props) => ReactNode> = {
  linkedin: LinkedIn,
  instagram: Instagram,
  twitter: XPost,
  threads: Threads,
  bluesky: Bluesky,
  mastodon: Mastodon,
  facebook: Facebook,
  substack: Substack,
  pinterest: Pinterest,
  tiktok: TikTok,
  youtube: YouTube,
  googlebusiness: GoogleBusiness,
};

/** Looks like the post will on that network. The look is a close approximation, not a pixel copy. */
export default function NetworkPreview(props: Props) {
  const Layout = LAYOUTS[serviceKey(props.service)] ?? LinkedIn;
  return <div aria-label={`${props.service} preview`}>{Layout(props)}</div>;
}
