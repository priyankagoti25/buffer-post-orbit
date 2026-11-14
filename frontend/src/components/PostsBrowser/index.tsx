import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { deletePost, listPosts } from "../../store/posts/postsService";
import { useSyncHandler } from "../../hooks/useSyncHandler";
import { errorMessage } from "../../lib/format";
import type { Bucket, Organization, Post } from "../../types/buffer";
import ChannelFilter from "../ChannelFilter";
import Loading from "../Loading";
import Modal from "../Modal";
import Notice from "../Notice";
import PostCard from "../PostCard";
import ScheduleModal from "../ScheduleModal";
import { BUCKET_LABEL } from "../StatusBadge";

const TABS: Bucket[] = ["queue", "draft", "overdue", "approval", "sent"];

type Props = {
  organizations: Organization[];
  /** Lock the list to one channel. */
  channelId?: string;
  initialBucket?: Bucket;
};

export default function PostsBrowser({
  organizations,
  channelId,
  initialBucket = "queue",
}: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const version = useAppSelector((s) => s.posts.version);
  const channels = useMemo(
    () => organizations.flatMap((o) => o.channels),
    [organizations],
  );
  const lockedChannel = channelId
    ? channels.find((c) => c.id === channelId)
    : undefined;
  const [orgId, setOrgId] = useState(
    lockedChannel?.organizationId ?? organizations[0]?.id ?? "",
  );
  const [channelFilter, setChannelFilter] = useState("");
  const [bucket, setBucket] = useState<Bucket>(initialBucket);
  const [posts, setPosts] = useState<Post[]>([]);
  const [after, setAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toSchedule, setToSchedule] = useState<Post | null>(null);
  const [toDelete, setToDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const request = useRef(0);

  const effectiveChannel = channelId ?? channelFilter;
  const org = organizations.find((o) => o.id === orgId);

  const load = useCallback(
    async (cursor: string | null, refresh = false) => {
      if (!orgId) return;
      const id = ++request.current;
      setLoading(true);
      setError("");
      try {
        const page = await listPosts({
          organizationId: orgId,
          channelId: effectiveChannel || undefined,
          bucket,
          after: cursor,
          refresh,
        });
        if (id !== request.current) return;
        setPosts((prev) => (cursor ? [...prev, ...page.posts] : page.posts));
        setAfter(page.pageInfo.endCursor);
        setHasMore(page.pageInfo.hasNextPage);
        setNote(page.note ?? "");
      } catch (e) {
        if (id === request.current)
          setError(errorMessage(e, "Could not load posts."));
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [orgId, effectiveChannel, bucket],
  );

  // Reload when the filters change or after any write (version).
  useEffect(() => {
    setPosts([]);
    void load(null, version > 0);
  }, [load, version]);

  useSyncHandler(() => load(null, true));

  const counts =
    lockedChannel?.counts ??
    (channelFilter
      ? channels.find((c) => c.id === channelFilter)?.counts
      : org?.counts);
  const channelsOfOrg = org?.channels ?? [];

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");
    const res = await dispatch(deletePost(toDelete.id));
    setDeleting(false);
    if (deletePost.rejected.match(res))
      return setDeleteError(
        res.payload?.message ?? "Could not delete the post.",
      );
    setToDelete(null);
  }

  return (
    <div>
      {!channelId && (
        <div className="mb-5 flex items-center flex-wrap gap-3">
          {organizations.length > 1 && (
            <select
              aria-label="Organization"
              className="field mt-0 w-auto"
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setChannelFilter("");
              }}
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <ChannelFilter
            channels={channelsOfOrg}
            value={channelFilter}
            onChange={setChannelFilter}
          />
        </div>
      )}

      <div role="tablist" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={bucket === t}
            onClick={() => setBucket(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              bucket === t
                ? "bg-forest-900 text-white"
                : "bg-sage-100 text-forest-800 hover:bg-sage-200"
            }`}
          >
            {BUCKET_LABEL[t]}
            {counts && <span className="ml-1.5 opacity-70">{counts[t]}</span>}
          </button>
        ))}
      </div>

      {error && (
        <Notice kind="error" className="mb-4">
          {error}{" "}
          <button className="underline" onClick={() => load(null, true)}>
            Try again
          </button>
        </Notice>
      )}
      {note && (
        <Notice kind="warning" className="mb-4">
          {note}
        </Notice>
      )}

      <div className="space-y-3">
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            channel={channels.find((c) => c.id === p.channelId)}
            showChannel={!channelId}
            onSchedule={setToSchedule}
            onRepost={(x) =>
              navigate(`/create?repost=${encodeURIComponent(x.id)}`)
            }
            onDelete={(x) => {
              setDeleteError("");
              setToDelete(x);
            }}
          />
        ))}
      </div>

      {loading && <Loading />}
      {!loading && !error && posts.length === 0 && (
        <div className="card p-10 text-center text-sm text-muted">
          Nothing in “{BUCKET_LABEL[bucket]}” right now.
        </div>
      )}
      {!loading && hasMore && (
        <div className="mt-5 text-center">
          <button className="btn btn-soft" onClick={() => load(after)}>
            Load more
          </button>
        </div>
      )}

      {toSchedule && (
        <ScheduleModal post={toSchedule} onClose={() => setToSchedule(null)} />
      )}
      {toDelete && (
        <Modal title="Delete this post?" onClose={() => setToDelete(null)}>
          <p className="line-clamp-4 whitespace-pre-wrap rounded-xl bg-cream p-3 text-sm">
            {toDelete.text}
          </p>
          <p className="mt-3 text-sm text-muted">
            This removes it from Buffer. It cannot be undone.
          </p>
          {deleteError && (
            <Notice kind="error" className="mt-3">
              {deleteError}
            </Notice>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => setToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
