import { AppError } from "../utils/errors";
import { bufferGraphQL, bufferGraphQLPartial } from "./buffer.service";
import { getRateLimit } from "./rateLimit.service";
import {
  prepareTarget,
  type AssetIn,
  type Target,
} from "./postMetadata.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type PostMode =
  | "addToQueue"
  | "shareNext"
  | "shareNow"
  | "customScheduled";
export type Bucket =
  | "queue"
  | "scheduled"
  | "draft"
  | "overdue"
  | "approval"
  | "sent"
  | "failed"
  | "other";

export interface BufferAsset {
  id?: string | null;
  mimeType?: string | null;
  source?: string | null;
  thumbnail?: string | null;
}

export interface BufferPost {
  id: string;
  text: string;
  createdAt: string;
  dueAt: string | null;
  sentAt: string | null;
  status: string;
  channelId: string;
  channelService: string;
  shareMode: string | null;
  schedulingType: string | null;
  isCustomScheduled: boolean;
  externalLink: string | null;
  assets: BufferAsset[];
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName?: string | null;
  service: string;
  avatar?: string | null;
  isQueuePaused?: boolean | null;
  isLocked?: boolean | null;
  isDisconnected?: boolean | null;
  timezone?: string | null;
  externalLink?: string | null;
  serviceId?: string | null;
  type?: string | null;
  createdAt?: string | null;
}

interface BufferOrganization {
  id: string;
  name: string;
  ownerEmail?: string | null;
  channelCount: number;
  shouldEnforce2FASetup?: boolean | null;
  members?: { totalCount: number } | null;
  limits?: Record<string, number | null> | null;
}

interface BufferAccount {
  id: string;
  email: string;
  backupEmail?: string | null;
  avatar?: string | null;
  createdAt?: string | null;
  timezone?: string | null;
  name?: string | null;
  preferences?: Record<string, unknown> | null;
  organizations: BufferOrganization[];
}

export type Counts = Record<Bucket, number>;
export const emptyCounts = (): Counts => ({
  queue: 0,
  scheduled: 0,
  draft: 0,
  overdue: 0,
  approval: 0,
  sent: 0,
  failed: 0,
  other: 0,
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
/** Ids go into the query text, so only allow safe characters. Returns a quoted string. */
const quoted = (id: string) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id))
    throw new AppError(400, "VALIDATION_ERROR", "Invalid id.");
  return JSON.stringify(id);
};

/** Buffer rejected the shape of our query (a field or value it does not know). */
function isValidationError(e: unknown): boolean {
  return (
    e instanceof AppError &&
    e.code === "BUFFER_API_ERROR" &&
    /cannot query|unknown|invalid value|not exist|enum|variable|expected|undefined field/i.test(
      e.message,
    )
  );
}

/** Decide which tab a post belongs to. */
export function bucketOf(
  p: Pick<BufferPost, "status" | "dueAt" | "isCustomScheduled">,
  now = Date.now(),
): Bucket {
  const s = String(p.status ?? "").toLowerCase();
  if (/approval/.test(s)) return "approval";
  if (s === "sent") return "sent";
  if (s === "sending") return "queue";
  if (s === "error" || s === "failed") return "failed";
  if (s === "draft")
    return p.dueAt && Date.parse(p.dueAt) < now ? "overdue" : "draft";
  // Buffer shows queued posts and posts with a chosen time together in one Queue tab, so we do too.
  if (s === "scheduled") return "queue";
  return "other";
}

const POST_FIELDS = `id text createdAt dueAt sentAt status channelId channelService shareMode schedulingType isCustomScheduled externalLink assets { id mimeType source thumbnail }`;
const POST_SHORT = `id text createdAt dueAt sentAt status channelId channelService shareMode isCustomScheduled externalLink`;

type Edge<T> = { node: T };
type Connection<T> = {
  edges: Edge<T>[];
  pageInfo?: { hasNextPage: boolean; endCursor?: string | null };
};

const normalizePost = (p: BufferPost): BufferPost => ({
  ...p,
  assets: p.assets ?? [],
});

// ---------------------------------------------------------------------------
// Overview: account + organizations + channels + post counts, in 3 requests
// ---------------------------------------------------------------------------
const ACCOUNT_QUERY = `query Account {
  account {
    id email backupEmail avatar createdAt timezone name
    preferences { timeFormat startOfWeek defaultScheduleOption }
    organizations {
      id name ownerEmail channelCount shouldEnforce2FASetup
      members { totalCount }
      limits { channels generateContent ideaGroups ideas members postTemplates savedReplies scheduledPosts scheduledStoriesPerChannel scheduledThreadsPerChannel tags }
    }
  }
}`;

const CHANNEL_BASE = "id name displayName service avatar isQueuePaused";
const CHANNEL_EXT = `${CHANNEL_BASE} isLocked isDisconnected timezone externalLink serviceId type createdAt`;
let channelTier: "ext" | "base" | null = null; // remembered so we do not retry a failing query

const MAX_ORGS = 14; // one request can hold 30 aliases; we use 2 per organization

async function loadChannels(userId: string, orgIds: string[]) {
  const build = (fields: string) =>
    `query Channels { ${orgIds
      .map(
        (id, i) =>
          `o${i}: channels(input: { organizationId: ${quoted(id)} }) { ${fields} }`,
      )
      .join("\n")} }`;
  const run = (fields: string) =>
    bufferGraphQL<Record<string, BufferChannel[]>>(userId, build(fields));

  let data: Record<string, BufferChannel[]>;
  if (channelTier === "base") {
    data = await run(CHANNEL_BASE);
  } else {
    try {
      data = await run(CHANNEL_EXT);
      channelTier = "ext";
    } catch (e) {
      if (!isValidationError(e)) throw e;
      data = await run(CHANNEL_BASE);
      channelTier = "base";
    }
  }
  return orgIds.map((_, i) => data[`o${i}`] ?? []);
}

async function runSnapshot(
  userId: string,
  orgIds: string[],
  statuses: string[],
) {
  const parts = orgIds.flatMap((id, i) => [
    `p${i}: posts(first: 100, input: { organizationId: ${quoted(id)}, filter: { status: [${statuses.join(", ")}] }, sort: [{ field: dueAt, direction: asc }] }) { edges { node { ${POST_FIELDS} } } pageInfo { hasNextPage } }`,
    `r${i}: posts(first: 100, input: { organizationId: ${quoted(id)}, sort: [{ field: createdAt, direction: desc }] }) { edges { node { ${POST_FIELDS} } } pageInfo { hasNextPage } }`,
  ]);
  const data = await bufferGraphQL<Record<string, Connection<BufferPost>>>(
    userId,
    `query Snapshot { ${parts.join("\n")} }`,
  );

  return orgIds.map((_, i) => {
    // Pending and recent lists overlap, so join them by post id.
    const byId = new Map<string, BufferPost>();
    for (const e of data[`p${i}`]?.edges ?? [])
      byId.set(e.node.id, normalizePost(e.node));
    for (const e of data[`r${i}`]?.edges ?? [])
      if (!byId.has(e.node.id)) byId.set(e.node.id, normalizePost(e.node));
    return {
      posts: [...byId.values()],
      pendingTruncated: Boolean(data[`p${i}`]?.pageInfo?.hasNextPage),
    };
  });
}

async function loadSnapshots(
  userId: string,
  orgIds: string[],
  warnings: string[],
) {
  for (const statuses of [["scheduled", "draft"], ["scheduled"]]) {
    try {
      return await runSnapshot(userId, orgIds, statuses);
    } catch (e) {
      if (!isValidationError(e)) throw e;
      warnings.push(
        `Buffer did not accept the status filter [${statuses.join(", ")}], so some post counts may be missing.`,
      );
    }
  }
  return orgIds.map(() => ({
    posts: [] as BufferPost[],
    pendingTruncated: false,
  }));
}

export async function loadOverview(userId: string) {
  const warnings: string[] = [];
  // Account first, so a token refresh (if needed) happens once before the parallel calls.
  const { account } = await bufferGraphQL<{ account: BufferAccount }>(
    userId,
    ACCOUNT_QUERY,
  );

  const orgs = account.organizations.slice(0, MAX_ORGS);
  if (account.organizations.length > MAX_ORGS) {
    warnings.push(
      `Showing the first ${MAX_ORGS} of ${account.organizations.length} organizations.`,
    );
  }
  const orgIds = orgs.map((o) => o.id);

  const [channelLists, snapshots] = orgIds.length
    ? await Promise.all([
        loadChannels(userId, orgIds),
        loadSnapshots(userId, orgIds, warnings),
      ])
    : [[], []];

  const now = Date.now();
  const upcoming: {
    id: string;
    text: string;
    dueAt: string | null;
    status: string;
    bucket: Bucket;
    channelId: string;
  }[] = [];

  const organizations = orgs.map((org, i) => {
    const posts = snapshots[i]?.posts ?? [];
    const countsByChannel = new Map<string, Counts>();
    const orgCounts = emptyCounts();
    for (const post of posts) {
      const bucket = bucketOf(post, now);
      const counts = countsByChannel.get(post.channelId) ?? emptyCounts();
      counts[bucket] += 1;
      orgCounts[bucket] += 1;
      countsByChannel.set(post.channelId, counts);
      if (
        post.dueAt &&
        ["queue", "scheduled", "draft", "overdue", "approval"].includes(bucket)
      ) {
        upcoming.push({
          id: post.id,
          text: post.text.slice(0, 140),
          dueAt: post.dueAt,
          status: post.status,
          bucket,
          channelId: post.channelId,
        });
      }
    }
    return {
      ...org,
      counts: orgCounts,
      pendingTruncated: snapshots[i]?.pendingTruncated ?? false,
      channels: (channelLists[i] ?? []).map((c) => ({
        ...c,
        organizationId: org.id,
        counts: countsByChannel.get(c.id) ?? emptyCounts(),
      })),
    };
  });

  const { organizations: _ignored, ...accountInfo } = account;
  void _ignored;
  return {
    account: accountInfo,
    organizations,
    upcoming,
    warnings,
    // "sent" counts only come from the latest 100 posts per organization.
    sentCountIsPartial: true,
    generatedAt: new Date().toISOString(),
    rateLimit: getRateLimit(),
  };
}

// ---------------------------------------------------------------------------
// Post lists (one tab at a time, with paging)
// ---------------------------------------------------------------------------
export type ListBucket = Bucket | "all";

const BUCKET_STATUSES: Record<ListBucket, string[] | null> = {
  queue: ["scheduled"],
  scheduled: ["scheduled"],
  draft: ["draft"],
  overdue: ["draft"],
  approval: ["needs_approval"],
  sent: ["sent"],
  failed: ["error"],
  other: null,
  all: null,
};

export async function listPosts(
  userId: string,
  args: {
    organizationId: string;
    channelId?: string;
    bucket: ListBucket;
    after?: string;
    first: number;
  },
) {
  const statuses = BUCKET_STATUSES[args.bucket];
  const sort =
    args.bucket === "queue" ||
    args.bucket === "scheduled" ||
    args.bucket === "draft" ||
    args.bucket === "overdue"
      ? "[{ field: dueAt, direction: asc }]"
      : "[{ field: createdAt, direction: desc }]";
  const filterParts: string[] = [];
  if (statuses) filterParts.push(`status: [${statuses.join(", ")}]`);
  if (args.channelId)
    filterParts.push(`channelIds: [${quoted(args.channelId)}]`);
  const filter = filterParts.length
    ? `filter: { ${filterParts.join(", ")} }, `
    : "";
  const after = args.after ? `, after: ${JSON.stringify(args.after)}` : "";

  const query = `query Posts { posts(first: ${args.first}${after}, input: { organizationId: ${quoted(args.organizationId)}, ${filter}sort: ${sort} }) { edges { node { ${POST_FIELDS} } } pageInfo { hasNextPage endCursor } } }`;

  let data: { posts: Connection<BufferPost> };
  try {
    data = await bufferGraphQL<{ posts: Connection<BufferPost> }>(
      userId,
      query,
    );
  } catch (e) {
    // The failed tab depends on a status name we could not confirm. Show an empty tab, not an error.
    if (args.bucket === "failed" && isValidationError(e)) {
      return {
        posts: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        note: 'Buffer did not accept the "error" status filter.',
      };
    }
    throw e;
  }

  const now = Date.now();
  const posts = data.posts.edges
    .map((e) => normalizePost(e.node))
    .filter((p) => {
      const b = bucketOf(p, now);
      if (args.bucket === "all") return true;
      if (args.bucket === "approval") return b === "approval";
      if (args.bucket === "other") return b === "other";
      return b === args.bucket;
    })
    .map((p) => ({ ...p, bucket: bucketOf(p, now) }));

  return {
    posts,
    pageInfo: {
      hasNextPage: Boolean(data.posts.pageInfo?.hasNextPage),
      endCursor: data.posts.pageInfo?.endCursor ?? null,
    },
    note: undefined as string | undefined,
  };
}

export async function getPost(userId: string, id: string) {
  const data = await bufferGraphQL<{ post: BufferPost | null }>(
    userId,
    `query Post { post(input: { id: ${quoted(id)} }) { ${POST_FIELDS} } }`,
  );
  if (!data.post) throw new AppError(404, "NOT_FOUND", "Post not found.");
  const post = normalizePost(data.post);
  return { ...post, bucket: bucketOf(post) };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
type MutationUnion = {
  __typename?: string;
  message?: string;
  post?: Partial<BufferPost>;
};

export interface CreateResult {
  channelId: string;
  ok: boolean;
  post?: Partial<BufferPost>;
  error?: string;
  /** How Buffer was asked to publish it. 'notification' means a reminder to post by hand. */
  schedulingType?: "automatic" | "notification";
}

/** Create the same post on several channels. One failed channel never hides the others. */
export async function createPosts(
  userId: string,
  args: {
    targets: Target[];
    text: string;
    mode: PostMode;
    dueAt?: string;
    saveToDraft: boolean;
    assets?: AssetIn[];
  },
): Promise<CreateResult[]> {
  const assets = args.assets ?? [];
  const useDue =
    !args.saveToDraft && args.mode === "customScheduled" && Boolean(args.dueAt);
  const mode = args.saveToDraft ? "addToQueue" : args.mode;

  // Check each channel's own rules first (for example Instagram needs media). Problems are
  // reported per channel and never stop the other channels.
  const prepared = args.targets.map((t) => ({
    t,
    ...prepareTarget(t, assets, args.text),
  }));
  const results: CreateResult[] = prepared.map((p) =>
    p.error
      ? { channelId: p.t.channelId, ok: false, error: p.error }
      : { channelId: p.t.channelId, ok: false },
  );
  const sendable = prepared
    .map((p, i) => ({ ...p, i }))
    .filter((p) => !p.error);
  if (!sendable.length) return results;

  const assetVars = assets.map((a) =>
    a.kind === "image"
      ? {
          image: {
            url: a.url,
            ...(a.altText ? { metadata: { altText: a.altText } } : {}),
          },
        }
      : { video: { url: a.url } },
  );

  /** Send one request for the given channels. `how` is the scheduling type to use for each. */
  const send = async (
    items: typeof sendable,
    how: (t: Target) => "automatic" | "notification",
  ) => {
    const declarations = ["$text: String", "$assets: [AssetInput!]!"];
    const variables: Record<string, unknown> = {
      text: args.text,
      assets: assetVars,
    };
    if (useDue) {
      declarations.push("$dueAt: DateTime");
      variables.dueAt = args.dueAt;
    }
    const fields = items.map((p) => {
      const hasMeta = Boolean(p.metadata);
      if (hasMeta) {
        declarations.push(`$m${p.i}: PostInputMetaData`);
        variables[`m${p.i}`] = p.metadata;
      }
      return `c${p.i}: createPost(input: { text: $text, channelId: ${quoted(p.t.channelId)}, schedulingType: ${how(p.t)}, mode: ${mode}, ${
        useDue ? "dueAt: $dueAt, " : ""
      }assets: $assets, ${hasMeta ? `metadata: $m${p.i}, ` : ""}needsApproval: false${
        args.saveToDraft ? ", saveToDraft: true" : ""
      } }) { __typename ... on PostActionSuccess { post { ${POST_SHORT} } } ... on MutationError { message } }`;
    });
    const res = await bufferGraphQLPartial<Record<string, MutationUnion>>(
      userId,
      `mutation CreatePosts(${declarations.join(", ")}) { ${fields.join("\n")} }`,
      variables,
    );
    if (!res.data && res.errors?.length) {
      throw new AppError(
        502,
        "BUFFER_API_ERROR",
        res.errors.map((e) => e.message).join("; "),
      );
    }
    for (const p of items) {
      const alias = `c${p.i}`;
      const item = res.data?.[alias];
      const used = how(p.t);
      if (item?.post?.id) {
        results[p.i] = {
          channelId: p.t.channelId,
          ok: true,
          post: item.post,
          schedulingType: used,
        };
        continue;
      }
      const gqlError = res.errors?.find((e) => e.path?.[0] === alias)?.message;
      const message =
        item?.message ??
        gqlError ??
        (item?.__typename
          ? `Buffer refused the post (${item.__typename}).`
          : "Buffer returned no result for this channel.");
      results[p.i] = {
        channelId: p.t.channelId,
        ok: false,
        error: message,
        schedulingType: used,
      };
    }
  };

  await send(sendable, (t) => t.options.schedulingType ?? "automatic");

  // Instagram personal profiles can only be reminded, not auto-published. Retry those as reminders.
  const retry = sendable.filter(
    (p) =>
      !results[p.i].ok &&
      /notification/i.test(results[p.i].error ?? "") &&
      (p.t.options.schedulingType ?? "automatic") !== "notification",
  );
  if (retry.length) await send(retry, () => "notification");
  return results;
}

/** Delete several posts in one request. Returns how many Buffer accepted. Never throws for one bad id. */
export async function deletePostsBatch(
  userId: string,
  ids: string[],
): Promise<number> {
  if (!ids.length) return 0;
  const run = async (withMessage: boolean) => {
    const fields = ids.map(
      (id, i) =>
        `d${i}: deletePost(input: { id: ${quoted(id)} }) { __typename${withMessage ? " ... on MutationError { message }" : ""} }`,
    );
    return bufferGraphQLPartial<Record<string, MutationUnion>>(
      userId,
      `mutation DeletePosts { ${fields.join("\n")} }`,
    );
  };
  let res = await run(true);
  if (
    !res.data &&
    res.errors?.some((e) =>
      /cannot query|unknown|undefined field/i.test(e.message),
    )
  )
    res = await run(false);
  if (!res.data) return 0;
  return ids.filter((_, i) => {
    const item = res.data?.[`d${i}`];
    return (
      item && !item.message && !res.errors?.some((e) => e.path?.[0] === `d${i}`)
    );
  }).length;
}

export async function editPost(
  userId: string,
  id: string,
  patch: {
    text?: string;
    dueAt?: string;
    mode?: PostMode;
    saveToDraft?: boolean;
    approvalChange?: "request" | "revert";
    assets?: AssetIn[];
  },
) {
  const parts = [`id: ${quoted(id)}`];
  const declarations: string[] = [];
  const variables: Record<string, unknown> = {};
  if (patch.text !== undefined) {
    declarations.push("$text: String");
    parts.push("text: $text");
    variables.text = patch.text;
  }
  if (patch.assets) {
    declarations.push("$assets: [AssetInput!]");
    parts.push("assets: $assets");
    variables.assets = patch.assets.map((a) =>
      a.kind === "image"
        ? {
            image: {
              url: a.url,
              ...(a.altText ? { metadata: { altText: a.altText } } : {}),
            },
          }
        : { video: { url: a.url } },
    );
  }
  if (patch.dueAt) {
    declarations.push("$dueAt: DateTime");
    parts.push("dueAt: $dueAt");
    variables.dueAt = patch.dueAt;
  }
  if (patch.mode)
    parts.push(`mode: ${patch.mode}`, "schedulingType: automatic");
  if (patch.saveToDraft !== undefined)
    parts.push(`saveToDraft: ${patch.saveToDraft}`);
  if (patch.approvalChange)
    parts.push(`approvalChange: ${patch.approvalChange}`);

  const decl = declarations.length ? `(${declarations.join(", ")})` : "";
  const data = await bufferGraphQL<{ editPost: MutationUnion }>(
    userId,
    `mutation EditPost${decl} { editPost(input: { ${parts.join(", ")} }) { __typename ... on PostActionSuccess { post { ${POST_SHORT} } } ... on MutationError { message } } }`,
    Object.keys(variables).length ? variables : undefined,
  );
  const result = data.editPost;
  if (!result?.post?.id) {
    throw new AppError(
      422,
      "BUFFER_REJECTED",
      result?.message ?? "Buffer did not accept the change.",
    );
  }
  return result.post;
}

export async function deletePost(userId: string, id: string) {
  // First try asking for the error message; if Buffer's schema says no, ask only for the type name.
  const variants = [
    `mutation DeletePost { deletePost(input: { id: ${quoted(id)} }) { __typename ... on MutationError { message } } }`,
    `mutation DeletePost { deletePost(input: { id: ${quoted(id)} }) { __typename } }`,
  ];
  let lastError: unknown;
  for (const query of variants) {
    try {
      const data = await bufferGraphQL<{ deletePost: MutationUnion }>(
        userId,
        query,
      );
      if (data.deletePost?.message)
        throw new AppError(422, "BUFFER_REJECTED", data.deletePost.message);
      return;
    } catch (e) {
      lastError = e;
      if (!isValidationError(e)) throw e;
    }
  }
  throw lastError;
}

/**
 * Send an idea to Buffer. Images go along with it. Buffer's API does not take videos for ideas,
 * so those stay in this app only. Returns the idea id and a note when something was left out.
 */
export async function createIdeaInBuffer(
  userId: string,
  organizationId: string,
  title: string,
  text: string,
  assets: AssetIn[] = [],
): Promise<{ id: string; note?: string }> {
  const images = assets.filter((a) => a.kind === "image");
  const skippedVideos = assets.length - images.length;
  const send = async (media: unknown[] | null) => {
    const declarations = ["$title: String", "$text: String"];
    const variables: Record<string, unknown> = { title, text };
    if (media) {
      declarations.push("$media: [IdeaMediaInput!]");
      variables.media = media;
    }
    const data = await bufferGraphQL<{
      createIdea: { __typename?: string; id?: string; message?: string };
    }>(
      userId,
      `mutation CreateIdea(${declarations.join(", ")}) { createIdea(input: { organizationId: ${quoted(organizationId)}, content: { title: $title, text: $text${media ? ", media: $media" : ""} } }) { __typename ... on Idea { id } ... on MutationError { message } } }`,
      variables,
    );
    const result = data.createIdea;
    if (!result?.id)
      throw new AppError(
        422,
        "BUFFER_REJECTED",
        result?.message ?? "Buffer did not accept the idea.",
      );
    return result.id;
  };

  const notes: string[] = [];
  if (skippedVideos)
    notes.push(
      "Buffer does not accept videos on ideas, so they stayed in this app.",
    );
  if (!images.length) {
    const id = await send(null);
    return { id, ...(notes.length ? { note: notes.join(" ") } : {}) };
  }
  // The media type name is not confirmed in Buffer's reference, so try the likely spellings, then fall back to text only.
  for (const type of ["image", "IMAGE"]) {
    try {
      const id = await send(
        images.map((a) => ({
          url: a.url,
          type,
          ...(a.altText ? { alt: a.altText } : {}),
        })),
      );
      return { id, ...(notes.length ? { note: notes.join(" ") } : {}) };
    } catch (e) {
      if (!isValidationError(e)) throw e;
    }
  }
  const id = await send(null);
  notes.push("Buffer did not accept the images, so only the text was sent.");
  return { id, note: notes.join(" ") };
}

const orgCache = new Map<string, { ids: string[]; at: number }>();

async function organizationIds(userId: string): Promise<string[]> {
  const hit = orgCache.get(userId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.ids;
  const acc = await bufferGraphQL<{
    account: { organizations: { id: string }[] };
  }>(userId, "query Orgs { account { organizations { id } } }");
  const ids = acc.account.organizations.map((o) => o.id);
  orgCache.set(userId, { ids, at: Date.now() });
  return ids;
}

/**
 * Which of these posts are still waiting in Buffer. It reads the account's list of scheduled posts and
 * checks the ids against it. A post missing from that list was deleted (or already sent).
 * If Buffer cannot be read, or the list is too long to read in one go, the post counts as still there.
 */
export async function postsStillExist(
  userId: string,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  try {
    const orgs = await organizationIds(userId);
    const parts = orgs.map(
      (id, i) =>
        `o${i}: posts(first: 100, input: { organizationId: ${quoted(id)}, filter: { status: [scheduled, sending] }, sort: [{ field: dueAt, direction: asc }] }) { edges { node { id } } pageInfo { hasNextPage } }`,
    );
    const data = await bufferGraphQL<
      Record<string, Connection<{ id: string }>>
    >(userId, `query Waiting { ${parts.join("\n")} }`);
    const present = new Set<string>();
    let incomplete = false;
    orgs.forEach((_, i) => {
      for (const e of data[`o${i}`]?.edges ?? []) present.add(e.node.id);
      if (data[`o${i}`]?.pageInfo?.hasNextPage) incomplete = true;
    });
    return ids.filter((id) => present.has(id) || incomplete);
  } catch {
    return ids; // cannot tell, so assume nothing was removed
  }
}

/**
 * Find posts on one channel that have the same text and are scheduled or already sent.
 * Used to explain Buffer's "same post twice" error. Best effort: returns [] if anything fails.
 */
export async function findSameTextPosts(
  userId: string,
  channelId: string,
  text: string,
) {
  try {
    const acc = await bufferGraphQL<{
      account: { organizations: { id: string }[] };
    }>(userId, "query Orgs { account { organizations { id } } }");
    const want = text.trim();
    const found: {
      id: string;
      status: string;
      dueAt: string | null;
      sentAt: string | null;
    }[] = [];
    for (const org of acc.account.organizations.slice(0, 3)) {
      const data = await bufferGraphQL<{ posts: Connection<BufferPost> }>(
        userId,
        `query Same { posts(first: 50, input: { organizationId: ${quoted(org.id)}, filter: { status: [scheduled, sent], channelIds: [${quoted(channelId)}] }, sort: [{ field: createdAt, direction: desc }] }) { edges { node { id text status dueAt sentAt } } } }`,
      );
      for (const e of data.posts.edges) {
        if ((e.node.text ?? "").trim() === want)
          found.push({
            id: e.node.id,
            status: String(e.node.status),
            dueAt: e.node.dueAt ?? null,
            sentAt: e.node.sentAt ?? null,
          });
      }
    }
    return found;
  } catch {
    return [];
  }
}

export type BufferIdea = {
  id: string;
  organizationId: string;
  title: string;
  text: string;
  assets: { kind: "image" | "video"; url: string; altText?: string }[];
  createdAt: string;
  updatedAt: string;
};

/** Every idea in the person's Buffer account (up to 100 per organization), newest first. */
export async function listBufferIdeas(userId: string): Promise<BufferIdea[]> {
  const orgs = await organizationIds(userId);
  const out: BufferIdea[] = [];
  for (const orgId of orgs.slice(0, 5)) {
    const data = await bufferGraphQL<{
      ideas: {
        edges: {
          node: {
            id: string;
            organizationId?: string;
            createdAt?: number;
            updatedAt?: number;
            content?: {
              title?: string | null;
              text?: string | null;
              media?:
                | { type?: string; url?: string; alt?: string | null }[]
                | null;
            };
          };
        }[];
      };
    }>(
      userId,
      `query Ideas { ideas(first: 100, input: { organizationId: ${quoted(orgId)} }) { edges { node { id organizationId createdAt updatedAt content { title text media { type url alt } } } } } }`,
    );
    for (const { node } of data.ideas?.edges ?? []) {
      const iso = (n?: number) =>
        n
          ? new Date(n > 1e12 ? n : n * 1000).toISOString()
          : new Date().toISOString();
      out.push({
        id: node.id,
        organizationId: node.organizationId ?? orgId,
        title: node.content?.title ?? "",
        text: node.content?.text ?? "",
        assets: (node.content?.media ?? [])
          .filter(
            (m) =>
              m.url &&
              (m.type === "image" || m.type === "video" || m.type === "gif"),
          )
          .map((m) => ({
            kind: m.type === "video" ? ("video" as const) : ("image" as const),
            url: m.url as string,
            ...(m.alt ? { altText: m.alt } : {}),
          })),
        createdAt: iso(node.createdAt),
        updatedAt: iso(node.updatedAt),
      });
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
