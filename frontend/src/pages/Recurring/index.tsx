import { useConfirm } from "../../components/ConfirmModal";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BufferGate from "../../components/BufferGate";
import ChannelAvatar from "../../components/ChannelAvatar";
import ChannelFilter from "../../components/ChannelFilter";
import Loading from "../../components/Loading";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import { getService } from "../../lib/channels";
import SyncButton from "../../components/SyncButton";
import { useSyncHandler } from "../../hooks/useSyncHandler";
import { formatDateTime } from "../../lib/format";
import { describeRule } from "../../lib/recurrence";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  cancelRecurring,
  fetchRecurring,
  pauseRecurring,
  resumeRecurring,
} from "../../store/recurring/recurringService";
import type { Channel, RecurringSeries } from "../../types/buffer";

const STATUS: Record<
  RecurringSeries["status"],
  { label: string; cls: string }
> = {
  active: { label: "Running", cls: "bg-sage-200 text-forest-900" },
  paused: { label: "Paused", cls: "bg-sand-100 text-sand-700" },
  completed: { label: "Finished", cls: "bg-stone-100 text-stone-700" },
  cancelled: { label: "Cancelled", cls: "bg-stone-100 text-stone-700" },
};

function SeriesCard({
  s,
  channels,
  confirm,
}: {
  s: RecurringSeries;
  channels: Channel[];
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const st = STATUS[s.status];
  const zone = s.rule.timezone;

  async function act(
    action: () => Promise<{
      meta: { requestStatus: string };
      payload?: unknown;
    }>,
  ) {
    setBusy(true);
    setError("");
    const res = await action();
    setBusy(false);
    if (res.meta.requestStatus === "rejected")
      setError(String(res.payload ?? "Something went wrong."));
    else {
      const warning = (res.payload as { warning?: string } | undefined)
        ?.warning;
      if (warning)
        await confirm({
          title: "Recurring post deleted",
          message: warning,
          confirmLabel: "OK",
          cancelLabel: null,
        });
    }
  }

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex -space-x-2">
          {s.targets.map((t) => {
            const c = channels.find((x) => x.id === t.channelId);
            return (
              <ChannelAvatar
                key={t.channelId}
                src={c?.avatar}
                name={c?.displayName || c?.name || "?"}
                service={t.service}
                size={28}
              />
            );
          })}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {s.targets
              .map(
                (t) =>
                  channels.find((x) => x.id === t.channelId)?.displayName ||
                  channels.find((x) => x.id === t.channelId)?.name ||
                  getService(t.service).label,
              )
              .join(", ")}
          </span>
          <span className="block text-xs text-muted">
            {describeRule(s.rule)} at {s.rule.time}
          </span>
        </span>
        <span className={`chip ${st.cls}`}>{st.label}</span>
        <span className="ml-auto text-xs text-muted">
          {s.publishedCount} sent so far
        </span>
      </div>

      <p className="mt-3 line-clamp-3 whitespace-pre-wrap wrap-break-word text-[0.93rem] leading-6">
        {s.text}
      </p>
      {s.assets.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          {s.assets.length} media file{s.assets.length === 1 ? "" : "s"}{" "}
          attached
        </p>
      )}

      {s.status === "active" && (
        <div className="mt-3 rounded-xl bg-cream p-3 text-xs">
          <p className="font-medium text-forest-900">Scheduled in Buffer</p>
          {s.upcoming.length ? (
            <ul className="mt-1 space-y-0.5 text-muted">
              {s.upcoming.map((u) => (
                <li key={u.index}>
                  {formatDateTime(u.dueAt, zone)}
                  {u.state === "partial" ? " · some channels failed" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">
              Nothing waiting. It will be scheduled shortly.
            </p>
          )}
        </div>
      )}

      {(s.skippedDuplicates?.length ?? 0) > 0 && (
        <Notice kind="warning" className="mt-3">
          Buffer refused {s.skippedDuplicates!.length} post(s) as “the same post
          twice”, so these times were skipped:{" "}
          {s.skippedDuplicates!.map((x) => formatDateTime(x.dueAt)).join(", ")}.{" "}
          {s.skippedDuplicates![0].message} To avoid this, edit the text and add{" "}
          {"{date}"} or {"{number}"} so every post is different.
        </Notice>
      )}
      {s.lastError && (
        <Notice kind="warning" className="mt-3">
          Last problem: {s.lastError}
          {s.status === "paused" && s.failures > 0
            ? " It was paused after repeated failures."
            : ""}
        </Notice>
      )}
      {error && (
        <Notice kind="error" className="mt-3">
          {error}
        </Notice>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {s.status === "active" && (
          <button
            className="btn btn-soft btn-sm"
            disabled={busy}
            onClick={() => act(() => dispatch(pauseRecurring(s.id)))}
          >
            Pause
          </button>
        )}
        {s.status === "paused" && (
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => act(() => dispatch(resumeRecurring(s.id)))}
          >
            Resume
          </button>
        )}
        {(s.status === "active" || s.status === "paused") && (
          <button
            className="btn btn-soft btn-sm"
            disabled={busy}
            onClick={() => navigate(`/create?series=${s.id}`)}
          >
            Edit
          </button>
        )}
        <button
          className="btn btn-danger btn-sm ml-auto"
          disabled={busy}
          onClick={async () => {
            const ok = await confirm({
              title: "Delete this recurring post?",
              message:
                "Its upcoming posts are removed from Buffer and the recurring post is deleted. Posts already sent stay.",
              confirmLabel: "Delete",
              cancelLabel: "Keep it",
              danger: true,
            });
            if (ok) void act(() => dispatch(cancelRecurring(s.id)));
          }}
        >
          Cancel series
        </button>
      </div>
    </article>
  );
}

function List({ channels }: { channels: Channel[] }) {
  const dispatch = useAppDispatch();
  const [channelFilter, setChannelFilter] = useState("");
  const { confirm, dialog } = useConfirm();
  const { items, loaded, loading, error } = useAppSelector((s) => s.recurring);

  // Always load fresh when the page opens (also checks Buffer), then watch quietly while it stays open.
  useEffect(() => {
    void dispatch(fetchRecurring());
  }, [dispatch]);

  useEffect(() => {
    const watch = () => {
      if (document.visibilityState === "visible")
        void dispatch(fetchRecurring({ quiet: true }));
    };
    const timer = window.setInterval(watch, 20_000);
    // Coming back to the tab: do a full check (reads Buffer too), not just the quiet one.
    const back = () => {
      if (document.visibilityState === "visible")
        void dispatch(fetchRecurring({ quiet: true }));
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [dispatch]);

  useSyncHandler(() => dispatch(fetchRecurring())); // the full check: it reads Buffer too

  const shown = channelFilter
    ? items.filter((s) => s.targets.some((t) => t.channelId === channelFilter))
    : items;

  return (
    <>
      {dialog}
      <div className="space-y-4">
        {items.length > 0 && (
          <ChannelFilter
            channels={channels}
            value={channelFilter}
            onChange={setChannelFilter}
          />
        )}
        {error && (
          <Notice kind="error">
            {error}{" "}
            <button
              className="underline"
              onClick={() => void dispatch(fetchRecurring())}
            >
              Try again
            </button>
          </Notice>
        )}
        {loading && !loaded && <Loading />}
        {loaded && items.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm text-muted">No recurring posts yet.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="/create" className="btn btn-primary">
                Write a post and repeat it
              </Link>
              <Link to="/posts" className="btn btn-soft">
                Repeat an old post (Posts, Sent)
              </Link>
            </div>
          </div>
        )}
        {items.length > 0 && shown.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">
            No recurring posts for this channel.
          </div>
        )}
        {shown.map((s) => (
          <SeriesCard key={s.id} s={s} channels={channels} confirm={confirm} />
        ))}
      </div>
    </>
  );
}

export default function RecurringPage() {
  return (
    <>
      <PageHeader
        eyebrow="Recurring"
        title="Posts that come back on their own"
        subtitle="This app keeps the next two posts scheduled for you. Use Pause to stop without losing the setup. Up to 20 recurring posts per account"
        actions={
          <>
            <SyncButton />
            <Link className="btn btn-primary" to="/create">
              New recurring post
            </Link>
          </>
        }
      />
      <BufferGate>
        {({ overview }) => (
          <List channels={overview.organizations.flatMap((o) => o.channels)} />
        )}
      </BufferGate>
    </>
  );
}
