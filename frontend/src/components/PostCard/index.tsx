import { Link } from 'react-router-dom';
import { formatDateTime } from '../../lib/format';
import type { Channel, Post } from '../../types/buffer';
import ChannelAvatar from '../ChannelAvatar';
import Icon from '../Icon';
import StatusBadge from '../StatusBadge';

type Props = {
  post: Post;
  channel?: Channel;
  showChannel?: boolean;
  onSchedule: (p: Post) => void;
  onDelete: (p: Post) => void;
  onRepost: (p: Post) => void;
};

export default function PostCard({ post, channel, showChannel = true, onSchedule, onDelete, onRepost }: Props) {
  const b = post.bucket;
  const editable = b === 'queue' || b === 'scheduled' || b === 'draft' || b === 'overdue';
  const canSchedule = b === 'draft' || b === 'overdue';
  const canDelete = editable || b === 'approval';
  const when = b === 'sent' ? post.sentAt : post.dueAt;
  const whenLabel = b === 'sent' ? 'Sent' : b === 'draft' || b === 'overdue' ? 'Planned for' : 'Goes out';
  const image = post.assets.find((a) => a.thumbnail || a.source);

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        {showChannel && channel && (
          <span className="flex min-w-0 items-center gap-2">
            <ChannelAvatar src={channel.avatar} name={channel.displayName || channel.name} service={channel.service} size={28} />
            <span className="truncate text-sm font-medium">{channel.displayName || channel.name}</span>
          </span>
        )}
        <StatusBadge bucket={b} rawStatus={post.status} />
        {post.recurring && (
          <span className="chip bg-forest-900 text-white">
            <Icon name="repeat" className="h-3 w-3" /> Recurring
          </span>
        )}
        {(post.repostCount ?? 0) > 0 && (
          <span className="chip bg-mist-100 text-forest-800">Reposted {post.repostCount}×</span>
        )}
        <span className="ml-auto text-xs text-muted">
          {when ? `${whenLabel} ${formatDateTime(when, channel?.timezone)}` : 'No time set'}
        </span>
      </div>

      <div className="mt-3 flex gap-4">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[0.93rem] leading-6">
          {post.text || <span className="text-muted">(no text)</span>}
        </p>
        {image && (
          <img
            src={image.thumbnail || image.source || ''}
            alt=""
            referrerPolicy="no-referrer"
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canSchedule && (
          <button className="btn btn-primary btn-sm" onClick={() => onSchedule(post)}>
            <Icon name="calendar" className="h-4 w-4" /> Schedule
          </button>
        )}
        {editable && (
          <Link to={`/create?edit=${encodeURIComponent(post.id)}`} className="btn btn-soft btn-sm">
            <Icon name="pen" className="h-4 w-4" /> Edit
          </Link>
        )}
        {b === 'sent' && (
          <button className="btn btn-primary btn-sm" onClick={() => onRepost(post)}>
            <Icon name="repeat" className="h-4 w-4" /> Repost
          </button>
        )}
        {post.externalLink && (
          <a href={post.externalLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            <Icon name="external" className="h-4 w-4" /> View live
          </a>
        )}
        {canDelete && (
          <button className="btn btn-danger btn-sm ml-auto" onClick={() => onDelete(post)}>
            <Icon name="trash" className="h-4 w-4" /> Delete
          </button>
        )}
      </div>
    </article>
  );
}
