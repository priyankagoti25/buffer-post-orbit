import type { IconType } from "react-icons";
import {
  FaBluesky,
  FaFacebook,
  FaGoogle,
  FaInstagram,
  FaLinkedin,
  FaMastodon,
  FaPinterest,
  FaThreads,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { SiSubstack } from "react-icons/si";
import { getService } from "../../lib/channels";

const ICONS: Record<string, IconType> = {
  twitter: FaXTwitter,
  linkedin: FaLinkedin,
  facebook: FaFacebook,
  threads: FaThreads,
  bluesky: FaBluesky,
  mastodon: FaMastodon,
  googlebusiness: FaGoogle,
  substack: SiSubstack,
  instagram: FaInstagram,
  pinterest: FaPinterest,
  tiktok: FaTiktok,
  youtube: FaYoutube,
};

/** The network's logo in its own colour. Falls back to a plain dot for networks we do not know. */
export default function ServiceIcon({
  service,
  size = 16,
  className = "",
}: {
  service: string;
  size?: number;
  className?: string;
}) {
  const info = getService(service);
  const Icon = ICONS[info.key];
  if (!Icon)
    return (
      <span
        className={`inline-block rounded-full ${className}`}
        style={{ width: size, height: size, background: info.color }}
        aria-hidden
      />
    );
  return (
    <Icon size={size} color={info.color} className={className} aria-hidden />
  );
}
