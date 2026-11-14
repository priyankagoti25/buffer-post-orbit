import { useConfirm } from "../../components/ConfirmModal";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import BufferGate from "../../components/BufferGate";
import ChannelPicker from "../../components/ChannelPicker";
import IdeaPicker from "../../components/IdeaPicker";
import Loading from "../../components/Loading";
import MediaUploader from "../../components/MediaUploader";
import AiAssistant from "../../components/AiAssistant";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import RecurrenceFields from "../../components/RecurrenceFields";
import RichTextEditor, {
  type EditorValue,
} from "../../components/RichTextEditor";
import ScheduleFields from "../../components/ScheduleFields";
import TargetSettings from "../../components/TargetSettings";
import { getService, limitFor, problemsFor } from "../../lib/channels";
import { errorMessage, toLocalInput } from "../../lib/format";
import {
  assetsFromPost,
  fromAssets,
  toAssets,
  type MediaItem,
} from "../../lib/media";
import {
  newRecurrence,
  newSchedule,
  recurrencePayload,
  recurrenceProblem,
  scheduleProblem,
  scheduleToPayload,
  type RecurrenceValue,
  type ScheduleKind,
} from "../../lib/schedule";
import {
  countCharacters,
  textToDoc,
  type DocNode,
} from "../../lib/unicodeText";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { createIdea, deleteIdea } from "../../store/ideas/ideasService";
import {
  createPosts,
  editPost,
  getPost,
  repostPost,
} from "../../store/posts/postsService";
import {
  fetchRecurring,
  saveRecurring,
} from "../../store/recurring/recurringService";
import type {
  CreateResult,
  Idea,
  Organization,
  Post,
  TargetOptions,
} from "../../types/buffer";
// import { useRecurringLimit } from "../../hooks/useRecurringLimit";
import { RECURRING_LIMIT } from "../../lib/recurrence";
import { useRecurringLimit } from "../../hooks/useRecurringLimit";

const EMPTY: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

type Seed = {
  doc?: DocNode | null;
  text?: string;
  assets?: Idea["assets"];
  ideaId?: string;
};

function Composer({ organizations }: { organizations: Organization[] }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const repostId = params.get("repost");
  const seriesId = params.get("series");
  const mode: "new" | "edit" | "repost" | "series" = editId
    ? "edit"
    : repostId
      ? "repost"
      : seriesId
        ? "series"
        : "new";
  const seed = (location.state as Seed | null) ?? null;
  const channels = useMemo(
    () => organizations.flatMap((o) => o.channels),
    [organizations],
  );
  const recurring = useAppSelector((s) => s.recurring);

  const startDoc: DocNode =
    seed?.doc ?? (seed?.text ? textToDoc(seed.text) : EMPTY);
  const [initial, setInitial] = useState<DocNode>(startDoc);
  const [editorKey, setEditorKey] = useState(0);
  const [value, setValue] = useState<EditorValue>({
    doc: startDoc,
    text: seed?.text ?? "",
  });
  const [media, setMedia] = useState<MediaItem[]>(() =>
    fromAssets(seed?.assets ?? []),
  );
  const [channelIds, setChannelIds] = useState<string[]>(() => {
    const c = params.get("channel");
    return c ? [c] : [];
  });
  const [options, setOptions] = useState<Record<string, TargetOptions>>({});
  const [schedule, setSchedule] = useState(
    newSchedule(
      mode === "edit" ? "keep" : mode === "repost" ? "custom" : "queue",
    ),
  );
  const [recurrence, setRecurrence] =
    useState<RecurrenceValue>(newRecurrence());
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(mode !== "new" && mode !== "series");
  const [loadError, setLoadError] = useState("");
  const [ideaId, setIdeaId] = useState<string | null>(seed?.ideaId ?? null);
  const [removeIdea, setRemoveIdea] = useState(false);
  const [ideaDeletable, setIdeaDeletable] = useState(
    Boolean((seed as { ideaDeletable?: boolean } | null)?.ideaDeletable),
  );
  const [pickIdea, setPickIdea] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [baseline, setBaseline] = useState({
    text: seed?.text ?? "",
    media: seed?.assets?.length ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [results, setResults] = useState<CreateResult[] | null>(null);
  const [done, setDone] = useState(false);

  function load(doc: DocNode, text: string, assets: Idea["assets"]) {
    setInitial(doc);
    setValue({ doc, text });
    setMedia(fromAssets(assets));
    setBaseline({ text, media: assets.length });
    setEditorKey((k) => k + 1);
  }

  // Load an existing post (edit or repost).
  useEffect(() => {
    const id = editId ?? repostId;
    if (!id) return;
    let live = true;
    setLoading(true);
    getPost(id)
      .then((p) => {
        if (!live) return;
        setPost(p);
        load(textToDoc(p.text), p.text, assetsFromPost(p.assets));
        setChannelIds([p.channelId]);
      })
      .catch(
        (e) =>
          live && setLoadError(errorMessage(e, "Could not load the post.")),
      )
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [editId, repostId]);

  // Load a recurring post to edit.
  useEffect(() => {
    if (!seriesId) return;
    if (!recurring.loaded) {
      if (!recurring.loading && !recurring.error)
        void dispatch(fetchRecurring());
      return;
    }
    const s = recurring.items.find((x) => x.id === seriesId);
    if (!s) {
      setLoadError("Recurring post not found.");
      return;
    }
    load(textToDoc(s.text), s.text, s.assets);
    setChannelIds(s.targets.map((t) => t.channelId));
    setOptions(
      Object.fromEntries(s.targets.map((t) => [t.channelId, t.options])),
    );
    const first = s.nextDueAt
      ? new Date(s.nextDueAt)
      : new Date(Date.now() + 86_400_000);
    setSchedule({ kind: "custom", dueLocal: toLocalInput(first) });
    setRecurrence({
      enabled: true,
      frequency: s.rule.frequency,
      interval: s.rule.interval,
      weekdays: s.rule.weekdays,
      end: s.endDate ? "date" : s.maxOccurrences ? "count" : "never",
      endDate: s.endDate ?? "",
      count: s.maxOccurrences ?? 10,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, recurring.loaded]);

  const selected = channels.filter((c) => channelIds.includes(c.id));
  const assets = toAssets(media);
  const hasVideo = assets.some((a) => a.kind === "video");
  // The tightest character limit among the chosen channels, so the AI keeps drafts inside it.
  const aiLimit = selected.reduce<number | null>((min, c) => {
    const l = limitFor(getService(c.service), hasVideo);
    return l !== null && (min === null || l < min) ? l : min;
  }, null);
  const uploading = media.some((m) => m.status === "uploading");
  // Repeating works for everything except drafts (they have no time) and edits.
  const canRepeat =
    mode !== "edit" && schedule.kind !== "draft" && schedule.kind !== "keep";
  // One recurring post per channel, 20 in total. Say so here, so no request is made that the server would refuse.
  const recurringLimit = useRecurringLimit(!seriesId);
  const repeatBlocked =
    mode === "series" || !recurringLimit.loaded
      ? null
      : recurringLimit.full
        ? `You already have ${RECURRING_LIMIT} recurring posts, the most allowed. Cancel one on the Recurring page to add another.`
        : selected.length > recurringLimit.left
          ? `You can add ${recurringLimit.left} more recurring post${recurringLimit.left === 1 ? "" : "s"} (each channel in a post counts as one), but ${selected.length} channels are selected.`
          : null;
  const repeating = canRepeat && recurrence.enabled && !repeatBlocked;

  // "Share now": the first repeat is the next matching time after now, so the series starts from this minute.
  const recurFrom =
    schedule.kind === "now" ? toLocalInput(new Date()) : schedule.dueLocal;
  const kinds: ScheduleKind[] =
    mode === "edit"
      ? ["keep", "custom", "queue", "draft"]
      : mode === "series"
        ? ["custom"]
        : mode === "repost"
          ? ["custom", "queue", "draft", "now"]
          : ["queue", "custom", "now", "draft"];
  const dirty =
    !done && (value.text !== baseline.text || media.length !== baseline.media);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function cancel() {
    if (
      dirty &&
      !(await confirm({
        title: "Discard this post?",
        message: "Your changes will be lost.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      }))
    )
      return;
    if (location.key !== "default") navigate(-1);
    else navigate("/dashboard");
  }

  async function useIdea(i: Idea) {
    // Close the picker first, so the question below is not hidden behind it.
    setPickIdea(false);
    if (
      value.text.trim() &&
      !(await confirm({
        title: "Replace your text?",
        message: "What you have written will be replaced with this idea.",
        confirmLabel: "Replace",
        cancelLabel: "Keep my text",
      }))
    )
      return;
    load(
      (i.contentJson as DocNode | null) ?? textToDoc(i.text),
      i.text,
      i.assets,
    );
    setIdeaId(i.id);
    setIdeaDeletable(i.source === "app" && i.syncStatus !== "synced");
  }

  // Text from the AI helper goes into the editor only when the person presses "Use in post".
  async function useDraft(text: string) {
    if (value.text.trim() && value.text.trim() !== text.trim()) {
      const ok = await confirm({
        title: "Replace your text?",
        message: "The editor text will be replaced with the AI draft.",
        confirmLabel: "Replace",
        cancelLabel: "Keep my text",
      });
      if (!ok) return;
    }
    const doc = textToDoc(text);
    setInitial(doc);
    setValue({ doc, text });
    setEditorKey((k) => k + 1);
  }

  async function saveDraftAsIdea(text: string): Promise<string | null> {
    const res = await dispatch(
      createIdea({
        title: text.split("\n")[0].slice(0, 60),
        text,
        contentJson: textToDoc(text) as Record<string, unknown>,
        assets: [],
        organizationId: organizations[0]?.id,
        syncToBuffer: true,
      }),
    );
    if (createIdea.rejected.match(res))
      return res.payload ?? "Could not save the idea.";
    return res.payload.syncStatus === "failed"
      ? `Saved here, but Buffer did not take it: ${res.payload.syncError ?? "unknown error"}`
      : null;
  }

  const targets = selected.map((c) => ({
    channelId: c.id,
    service: getService(c.service).key,
    options: options[c.id] ?? {},
  }));

  function checkProblems(): string | null {
    if (!value.text.trim() && !assets.length)
      return "Write some text or add media first.";
    if (!channelIds.length) return "Pick at least one channel.";
    if (uploading) return "Wait for the uploads to finish.";
    if (media.some((m) => m.status === "error"))
      return "Remove the files that failed to upload.";
    for (const c of selected) {
      const info = getService(c.service);
      const issues = problemsFor(c.service, assets, options[c.id] ?? {});
      if (issues.length) return issues[0];
      const limit = limitFor(info, hasVideo);
      if (
        info.key !== "twitter" &&
        limit !== null &&
        countCharacters(info.key, value.text) > limit
      )
        return `Too long for ${info.label} (limit ${limit}).`;
    }
    if (
      repeating &&
      schedule.kind === "queue" &&
      new Date(schedule.dueLocal).getTime() < Date.now() + 60_000
    )
      return "Pick a future time for the first repeat.";
    return (
      scheduleProblem(schedule) ??
      (repeating
        ? recurrenceProblem(recurFrom, recurrence, schedule.kind)
        : null)
    );
  }

  async function submit() {
    setError("");
    setSaved("");
    const problem = checkProblems();
    if (problem) return setError(problem);
    setBusy(true);

    if (mode === "edit" && editId) {
      const res = await dispatch(
        editPost({
          id: editId,
          text: value.text,
          ...scheduleToPayload(schedule),
        }),
      );
      setBusy(false);
      if (editPost.rejected.match(res))
        return setError(res.payload?.message ?? "Could not save the changes.");
      setBaseline({ text: value.text, media: media.length });
      return setSaved("Changes saved.");
    }

    if (repeating && schedule.kind === "custom") {
      const p = recurrencePayload(schedule.dueLocal, recurrence);
      const res = await dispatch(
        saveRecurring({
          id: seriesId ?? undefined,
          body: {
            ...p,
            name: "",
            text: value.text,
            assets,
            targets,
            sourcePostId: repostId,
          },
        }),
      );
      setBusy(false);
      if (saveRecurring.rejected.match(res))
        return setError(res.payload ?? "Could not save the recurring post.");
      setDone(true);
      navigate("/recurring");
      return;
    }

    const body = {
      targets,
      assets,
      text: value.text,
      ...scheduleToPayload(schedule),
    };
    const res = repostId
      ? await dispatch(repostPost({ id: repostId, ...body }))
      : await dispatch(createPosts(body));
    setBusy(false);
    if (res.meta.requestStatus === "rejected") {
      const payload = res.payload as
        | { message?: string; results?: CreateResult[] }
        | undefined;
      setError(payload?.message ?? "Could not create the post.");
      if (payload?.results) {
        setResults(payload.results);
        setChannelIds(
          payload.results.filter((r) => !r.ok).map((r) => r.channelId),
        );
      }
      return;
    }
    const list = (res.payload as { results: CreateResult[] }).results;
    setResults(list);

    // Queue / share now + repeat: the first post is out, so start the repeats for the channels that worked.
    let repeatError = "";
    if (repeating) {
      const okTargets = targets.filter((t) =>
        list.some((r) => r.ok && r.channelId === t.channelId),
      );
      if (okTargets.length) {
        const p = recurrencePayload(recurFrom, recurrence);
        const rec = await dispatch(
          saveRecurring({
            body: {
              ...p,
              name: "",
              text: value.text,
              assets,
              targets: okTargets,
              sourcePostId: repostId,
            },
          }),
        );
        if (saveRecurring.rejected.match(rec))
          repeatError = `The first post was sent, but the recurring post could not be set up: ${rec.payload ?? "unknown error"}. You can create it from the Recurring page.`;
      }
    }
    if (repeatError) setError(repeatError);
    if (list.every((r) => r.ok) && !repeatError) {
      setDone(true);
      if (ideaId && removeIdea) void dispatch(deleteIdea(ideaId));
    } else {
      setError(
        "Some channels failed. They are still selected so you can try again.",
      );
      setChannelIds(list.filter((r) => !r.ok).map((r) => r.channelId));
    }
  }

  async function saveAsIdea() {
    setError("");
    if (!value.text.trim() && !assets.length)
      return setError("Write some text or add media first.");
    const res = await dispatch(
      createIdea({
        title: value.text.split("\n")[0].slice(0, 60),
        text: value.text,
        contentJson: value.doc as Record<string, unknown>,
        assets,
      }),
    );
    if (createIdea.rejected.match(res))
      return setError(res.payload ?? "Could not save the idea.");
    setSaved("Saved to Ideas.");
  }

  function reset() {
    load(EMPTY, "", []);
    setResults(null);
    setError("");
    setSaved("");
    setDone(false);
    setIdeaId(null);
    setRecurrence(newRecurrence());
  }

  const name = (id: string) =>
    channels.find((c) => c.id === id)?.displayName ||
    channels.find((c) => c.id === id)?.name ||
    id;

  if (loading) return <Loading />;
  if (loadError)
    return (
      <Notice kind="error">
        {loadError}{" "}
        <Link className="underline" to="/posts">
          Back to posts
        </Link>
      </Notice>
    );

  if (done && results) {
    return (
      <div className="card space-y-4 p-6 sm:p-8">
        <Notice kind="success">
          Done. Your post was created on {results.length} channel
          {results.length === 1 ? "" : "s"}.
        </Notice>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={reset}>
            Write another
          </button>
          <Link className="btn btn-soft" to="/posts">
            View posts
          </Link>
        </div>
      </div>
    );
  }

  const limits = selected.map((c) => {
    const info = getService(c.service);
    const limit = limitFor(info, hasVideo);
    const n = countCharacters(info.key, value.text);
    return { c, info, limit, n, bad: limit !== null && n > limit };
  });

  return (
    <>
      {dialog}
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          {mode === "repost" && (
            <Notice kind="info">
              Reposting an old post. The original stays as it is. Change
              anything you like below.
            </Notice>
          )}
          {mode === "series" && (
            <Notice kind="info">
              Editing the recurring post for one channel. Saving removes its
              upcoming posts from Buffer and schedules them again from the time
              below.
            </Notice>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="label-eyebrow">Write</p>
              {mode === "new" && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPickIdea(true)}
                >
                  Start from an idea
                </button>
              )}
            </div>
            <RichTextEditor
              key={editorKey}
              initialContent={initial}
              onChange={setValue}
              footer={
                limits.length ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {limits.map(({ c, info, limit, n, bad }) => (
                      <span
                        key={c.id}
                        className={
                          bad ? "font-semibold text-red-700" : "text-muted"
                        }
                      >
                        {info.label}: {n}
                        {limit ? ` / ${limit}` : ""}
                      </span>
                    ))}
                  </div>
                ) : undefined
              }
            />
          </div>

          <div>
            <p className="label-eyebrow mb-2">Media</p>
            {mode === "edit" ? (
              <p className="rounded-xl bg-cream p-3 text-sm text-muted">
                Media on an existing post cannot be changed.{" "}
                {media.length
                  ? `This post has ${media.length} file${media.length === 1 ? "" : "s"}.`
                  : ""}
              </p>
            ) : (
              <MediaUploader value={media} onChange={setMedia} />
            )}
          </div>

          <div>
            <p className="label-eyebrow mb-2">Channels</p>
            <ChannelPicker
              organizations={organizations}
              value={channelIds}
              onChange={setChannelIds}
              single={mode === "edit" || mode === "series"}
              lockedTo={mode === "series" ? channelIds[0] : post?.channelId}
            />
          </div>

          {mode !== "edit" && selected.length > 0 && (
            <TargetSettings
              channels={selected}
              options={options}
              hasVideo={hasVideo}
              onChange={(id, p) =>
                setOptions((o) => ({ ...o, [id]: { ...o[id], ...p } }))
              }
            />
          )}

          <div>
            <p className="label-eyebrow mb-2">When</p>
            <ScheduleFields
              name="compose-when"
              value={schedule}
              onChange={setSchedule}
              kinds={kinds}
            />
            {canRepeat && (
              <div className="mt-3">
                <RecurrenceFields
                  value={recurrence}
                  onChange={setRecurrence}
                  blockedReason={repeatBlocked}
                  kind={schedule.kind}
                  dueLocal={recurFrom}
                  onStartChange={(v) =>
                    setSchedule({ ...schedule, dueLocal: v })
                  }
                />
              </div>
            )}
          </div>

          {mode === "new" && ideaId && ideaDeletable && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={removeIdea}
                onChange={(e) => setRemoveIdea(e.target.checked)}
                className="accent-[#17261d]"
              />{" "}
              Delete the idea after posting
            </label>
          )}

          {error && <Notice kind="error">{error}</Notice>}
          {saved && <Notice kind="success">{saved}</Notice>}
          {results?.some((r) => !r.ok) && (
            <ul className="space-y-1 text-sm">
              {results.map((r) => (
                <li
                  key={r.channelId}
                  className={r.ok ? "text-forest-800" : "text-red-700"}
                >
                  {name(r.channelId)}: {r.ok ? "created" : r.error}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary px-6"
              onClick={submit}
              disabled={busy || uploading}
            >
              {busy
                ? "Working…"
                : uploading
                  ? "Uploading…"
                  : mode === "edit" || mode === "series"
                    ? "Save changes"
                    : repeating
                      ? schedule.kind === "now"
                        ? "Post now and repeat"
                        : schedule.kind === "queue"
                          ? "Add to queue and repeat"
                          : "Start recurring post"
                      : schedule.kind === "draft"
                        ? "Save draft"
                        : schedule.kind === "now"
                          ? "Post now"
                          : mode === "repost"
                            ? "Repost"
                            : "Create post"}
            </button>
            {mode === "new" && (
              <button
                className="btn btn-soft"
                onClick={saveAsIdea}
                disabled={busy}
              >
                Save as idea
              </button>
            )}
            <button className="btn btn-ghost" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>

        <aside className="min-w-0 lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <AiAssistant
              draft={value.text}
              networks={selected.map((c) => getService(c.service).label)}
              limit={aiLimit}
              onUseInPost={useDraft}
              onSaveAsIdea={saveDraftAsIdea}
            />
          </div>
        </aside>

        {pickIdea && (
          <IdeaPicker onPick={useIdea} onClose={() => setPickIdea(false)} />
        )}
      </div>
    </>
  );
}

export default function ComposePage() {
  const [params] = useSearchParams();
  const mode = params.get("edit")
    ? "edit"
    : params.get("repost")
      ? "repost"
      : params.get("series")
        ? "series"
        : "new";
  const titles = {
    new: ["New post", "Write something worth sharing"],
    edit: ["Edit post", "Polish it"],
    repost: ["Repost", "Give a good post a second life"],
    series: ["Recurring post", "Change how it repeats"],
  } as const;
  return (
    <>
      <PageHeader
        eyebrow={titles[mode][0]}
        title={titles[mode][1]}
        subtitle="Write it yourself, or ask the AI Writing Helper to draft or improve it, then press “Use in post”. Bold, italic, underline, strikethrough and links work on every text network."
      />
      <BufferGate>
        {({ overview }) => <Composer organizations={overview.organizations} />}
      </BufferGate>
    </>
  );
}
