import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BufferGate from "../../components/BufferGate";
import { useConfirm } from "../../components/ConfirmModal";
import Icon from "../../components/Icon";
import Loading from "../../components/Loading";
import MediaUploader from "../../components/MediaUploader";
import Modal from "../../components/Modal";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import RichTextEditor, {
  type EditorValue,
} from "../../components/RichTextEditor";
import SyncButton from "../../components/SyncButton";
import { useSyncHandler } from "../../hooks/useSyncHandler";
import { useOverview } from "../../hooks/useOverview";
import { timeAgo } from "../../lib/format";
import {
  fromAssets,
  isStillImage,
  toAssets,
  type MediaItem,
} from "../../lib/media";
import { textToDoc, type DocNode } from "../../lib/unicodeText";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  createIdea,
  deleteIdea,
  fetchIdeas,
  updateIdea,
} from "../../store/ideas/ideasService";
import type { Idea } from "../../types/buffer";

const EMPTY: DocNode = { type: "doc", content: [{ type: "paragraph" }] };
type Filter = "all" | "buffer" | "local";

type PostSeed = {
  doc: unknown;
  text: string;
  assets: Idea["assets"];
  ideaId?: string;
  ideaDeletable?: boolean;
};

/**
 * One dialog for three cases: a new idea, an idea saved only in this app (can be edited),
 * and an idea that lives in Buffer (read only, because Buffer's API cannot edit ideas).
 */
function IdeaDialog({
  idea,
  orgs,
  canSync,
  onClose,
  onSaved,
  onMakePost,
}: {
  idea: Idea | null;
  orgs: { id: string; name: string }[];
  canSync: boolean;
  onClose: () => void;
  onSaved: (note: string | null) => void;
  onMakePost: (seed: PostSeed) => void;
}) {
  const dispatch = useAppDispatch();
  const editable =
    !idea || (idea.source === "app" && idea.syncStatus !== "synced");
  const [title, setTitle] = useState(idea?.title ?? "");
  const [value, setValue] = useState<EditorValue>({
    doc:
      (idea?.contentJson as DocNode | null) ??
      (idea ? textToDoc(idea.text) : EMPTY),
    text: idea?.text ?? "",
  });
  const [media, setMedia] = useState<MediaItem[]>(() =>
    fromAssets(idea?.assets ?? []),
  );
  const [sync, setSync] = useState(canSync);
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Buffer ideas accept still images only. With anything else attached, the box is switched off, so no doomed call is made.
  const onlyStills = media.every((m) => isStillImage(m));
  const canSendToBuffer = canSync && onlyStills && orgs.length > 0;
  const sendToBuffer = !idea && sync && canSendToBuffer;

  function problem(): string | null {
    if (!value.text.trim() && !media.length)
      return "Write some text or add media first.";
    if (media.some((m) => m.status === "uploading"))
      return "Wait for the uploads to finish.";
    if (media.some((m) => m.status === "error"))
      return "Remove the files that failed to upload.";
    return null;
  }

  async function save() {
    const p = problem();
    if (p) return setError(p);
    setBusy(true);
    setError("");
    const body = {
      title: title.trim() || value.text.split("\n")[0].slice(0, 60),
      text: value.text || " ",
      contentJson: value.doc as Record<string, unknown>,
      assets: toAssets(media),
    };
    const res = idea
      ? await dispatch(updateIdea({ id: idea.id, ...body }))
      : await dispatch(
          createIdea({
            ...body,
            organizationId: orgId || undefined,
            syncToBuffer: sendToBuffer,
          }),
        );
    setBusy(false);
    if (res.meta.requestStatus === "rejected")
      return setError((res.payload as string) ?? "Could not save.");
    const saved = res.payload as Idea;
    onSaved(
      saved.syncStatus === "failed"
        ? `Saved here, but Buffer did not take it: ${saved.syncError ?? "unknown error"}`
        : idea
          ? null
          : saved.syncError,
    );
  }

  function makePost() {
    const p = problem();
    if (p) return setError(p);
    // The idea stays as it is. The composer starts from this text, even if it was never saved.
    onMakePost({
      doc: value.doc,
      text: value.text,
      assets: toAssets(media),
      ...(idea ? { ideaId: idea.id, ideaDeletable: editable } : {}),
    });
  }

  return (
    <Modal
      title={!idea ? "New idea" : editable ? "Idea" : idea.title || "Idea"}
      onClose={onClose}
      wide
    >
      {editable ? (
        <div className="space-y-4">
          <input
            className="field"
            placeholder="Title (optional)"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Idea title"
          />
          <RichTextEditor
            initialContent={value.doc as DocNode}
            onChange={setValue}
            placeholder="What's the idea?"
            label="Idea text"
          />
          <MediaUploader value={media} onChange={setMedia} />
          {!idea && (
            <div className={`space-y-2 ${canSendToBuffer ? "" : "opacity-60"}`}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!canSendToBuffer}
                  checked={sendToBuffer}
                  onChange={(e) => setSync(e.target.checked)}
                  className="accent-[#17261d]"
                />
                Also save it in Buffer (text and still images)
              </label>
              {!canSync && (
                <p className="text-xs text-muted">
                  Buffer has not given this app the ideas permission yet.
                  Reconnect Buffer in Settings, then try again.
                </p>
              )}
              {canSync && !onlyStills && (
                <p className="text-xs text-muted">
                  Buffer ideas take still images only. Remove the video or GIF
                  to send this idea to Buffer. It stays in this app either way.
                </p>
              )}
              {sendToBuffer && orgs.length > 1 && (
                <select
                  className="field max-w-xs"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  aria-label="Organization"
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="whitespace-pre-wrap wrap-break-word text-sm">
            {idea?.text}
          </p>
          {(idea?.assets.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {idea!.assets.map((a, n) =>
                a.kind === "image" ? (
                  <img
                    key={n}
                    src={a.url}
                    alt=""
                    className="h-28 w-28 rounded-xl object-cover"
                  />
                ) : (
                  <video
                    key={n}
                    src={`${a.url}#t=0.1`}
                    controls
                    preload="metadata"
                    className="h-28 rounded-xl"
                  />
                ),
              )}
            </div>
          )}
          <p className="text-xs text-muted">
            This idea is saved in Buffer. Buffer's API cannot change or delete
            ideas, so edit it in Buffer. “Make post” copies it into a new post.
          </p>
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {editable ? "Cancel" : "Close"}
        </button>
        <button className="btn btn-soft" onClick={makePost} disabled={busy}>
          <Icon name="pen" className="h-4 w-4" /> Make post
        </button>
        {editable && (
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save idea"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function IdeaCard({
  idea,
  onOpen,
  onUse,
  onDelete,
}: {
  idea: Idea;
  onOpen: () => void;
  onUse: () => void;
  onDelete: (() => void) | null;
}) {
  return (
    <article
      className="card flex cursor-pointer flex-col p-4 transition-shadow hover:shadow-md"
      role="button"
      tabIndex={0}
      aria-label={`Open idea: ${idea.title || "Untitled"}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-sans text-sm font-semibold">
          {idea.title || "Untitled"}
        </h3>
        <span
          className={`chip shrink-0 ${idea.syncStatus === "synced" ? "bg-sage-100 text-forest-800" : idea.syncStatus === "failed" ? "bg-sand-100 text-sand-700" : "bg-stone-100 text-stone-700"}`}
        >
          {idea.syncStatus === "synced"
            ? "In Buffer"
            : idea.syncStatus === "failed"
              ? "Not sent"
              : "Only here"}
        </span>
      </div>
      {idea.assets.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {idea.assets.slice(0, 3).map((a, n) =>
            a.kind === "image" ? (
              <img
                key={n}
                src={a.url}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <span
                key={n}
                className="grid h-14 w-14 place-items-center rounded-lg bg-stone-200 text-xs"
              >
                Video
              </span>
            ),
          )}
          {idea.assets.length > 3 && (
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-stone-100 text-xs text-muted">
              +{idea.assets.length - 3}
            </span>
          )}
        </div>
      )}
      <p className="mt-2 line-clamp-5 whitespace-pre-wrap wrap-break-word text-sm">
        {idea.text}
      </p>
      {idea.syncStatus === "failed" && idea.syncError && (
        <p className="mt-2 text-xs text-sand-700">{idea.syncError}</p>
      )}
      <p className="mt-2 text-xs text-muted">{timeAgo(idea.updatedAt)}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
        >
          <Icon name="pen" className="h-4 w-4" /> Make post
        </button>
        {onDelete && (
          <button
            className="btn btn-danger btn-sm ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete idea"
          >
            <Icon name="trash" className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function IdeasList() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const { items, loaded, loading, error, bufferError } = useAppSelector(
    (s) => s.ideas,
  );
  const { status, overview } = useOverview();
  const canSync = Boolean(
    status?.scope?.split(/[\s,]+/).includes("ideas:write"),
  );
  const orgs = (overview?.organizations ?? []).map((o) => ({
    id: o.id,
    name: o.name,
  }));

  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Idea | "new" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchIdeas());
  }, [dispatch]);
  useSyncHandler(() => dispatch(fetchIdeas({ refresh: true })));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "buffer" && i.syncStatus !== "synced") return false;
      if (filter === "local" && i.syncStatus === "synced") return false;
      return !t || `${i.title} ${i.text}`.toLowerCase().includes(t);
    });
  }, [items, filter, q]);

  const inBuffer = items.filter((i) => i.syncStatus === "synced").length;

  return (
    <>
      {dialog}
      <PageHeader
        eyebrow="Ideas"
        title="Catch it before it's gone"
        subtitle="Every idea in your Buffer account is here, plus ideas you saved in this app. Press “Make post” to turn one into a post. The same ideas show up when you start a new post"
        actions={<SyncButton />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={() => setOpen("new")}>
          <Icon name="plus" className="h-4 w-4" /> New idea
        </button>
        <input
          className="field mt-0 w-full max-w-xs"
          placeholder="Search ideas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search ideas"
        />
        <div role="tablist" className="flex gap-1">
          {(
            [
              ["all", `All (${items.length})`],
              ["buffer", `In Buffer (${inBuffer})`],
              ["local", `Only here (${items.length - inBuffer})`],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === k ? "bg-forest-900 text-white" : "bg-sage-100 text-forest-800 hover:bg-sage-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {note && (
        <div className="mb-4">
          <Notice kind="warning">{note}</Notice>
        </div>
      )}
      {bufferError && (
        <div className="mb-4">
          <Notice kind="warning">
            Could not read your ideas from Buffer: {bufferError} If it mentions
            permission, reconnect Buffer in Settings so the ideas permission is
            granted. Ideas saved in this app are still shown.
          </Notice>
        </div>
      )}
      {error && (
        <Notice kind="error">
          {error}{" "}
          <button
            className="underline"
            onClick={() => void dispatch(fetchIdeas())}
          >
            Try again
          </button>
        </Notice>
      )}
      {loading && !loaded && <Loading />}
      {loaded && shown.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">
          {items.length
            ? "No matching ideas."
            : "No ideas yet. Press “New idea” to add one."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((i) => (
          <IdeaCard
            key={i.id}
            idea={i}
            onOpen={() => setOpen(i)}
            onUse={() =>
              navigate("/create", {
                state: {
                  doc: i.contentJson,
                  text: i.text,
                  assets: i.assets,
                  ideaId: i.id,
                  ideaDeletable:
                    i.source === "app" && i.syncStatus !== "synced",
                },
              })
            }
            // Buffer's API cannot delete ideas, so only ideas that exist just here can be deleted.
            onDelete={
              i.source === "app" && i.syncStatus !== "synced"
                ? async () => {
                    if (
                      await confirm({
                        title: "Delete this idea?",
                        message:
                          "The idea is removed from this app. It cannot be undone.",
                        confirmLabel: "Delete",
                        danger: true,
                      })
                    )
                      void dispatch(deleteIdea(i.id));
                  }
                : null
            }
          />
        ))}
      </div>
      {inBuffer > 0 && (
        <p className="mt-4 text-xs text-muted">
          Ideas that are in Buffer can only be deleted in Buffer. Buffer's API
          does not allow deleting them.
        </p>
      )}

      {open && (
        <IdeaDialog
          key={open === "new" ? "new" : open.id}
          idea={open === "new" ? null : open}
          orgs={orgs}
          canSync={canSync}
          onClose={() => setOpen(null)}
          onSaved={(n) => {
            setOpen(null);
            setNote(n);
            void dispatch(fetchIdeas()); // the server already dropped its cache when the idea was saved
          }}
          onMakePost={(seed) => navigate("/create", { state: seed })}
        />
      )}
    </>
  );
}

export default function IdeasPage() {
  return <BufferGate>{() => <IdeasList />}</BufferGate>;
}
