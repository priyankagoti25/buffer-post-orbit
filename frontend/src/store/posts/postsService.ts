import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import type { SchedulePayload } from "../../lib/schedule";
import type {
  Asset,
  Bucket,
  CreateResult,
  Post,
  PostsPage,
  Target,
} from "../../types/buffer";

export type PostRejection = { message: string; results?: CreateResult[] };

function rejection(e: unknown, fallback: string): PostRejection {
  const data = (e as { response?: { data?: { results?: CreateResult[] } } })
    ?.response?.data;
  return { message: errorMessage(e, fallback), results: data?.results };
}

// ---- Reads (plain functions: lists live in the page, not in Redux) ------------------------------
export async function listPosts(params: {
  organizationId: string;
  channelId?: string;
  bucket: Bucket | "all";
  after?: string | null;
  refresh?: boolean;
}): Promise<PostsPage> {
  const { data } = await api.get<PostsPage>("/api/buffer/posts", {
    params: {
      organizationId: params.organizationId,
      channelId: params.channelId || undefined,
      bucket: params.bucket,
      after: params.after || undefined,
      refresh: params.refresh ? 1 : undefined,
    },
  });
  return data;
}

export async function getPost(id: string): Promise<Post> {
  const { data } = await api.get<{ post: Post }>(
    `/api/buffer/posts/${encodeURIComponent(id)}`,
  );
  return data.post;
}

// ---- Writes (thunks: the buffer slice marks its numbers stale after any of these) ---------------
type RejectConfig = { rejectValue: PostRejection };

export const createPosts = createAsyncThunk<
  { results: CreateResult[] },
  { targets: Target[]; assets: Asset[]; text: string } & SchedulePayload,
  RejectConfig
>("posts/create", async (input, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{ results: CreateResult[] }>(
      "/api/buffer/posts",
      input,
    );
    return data;
  } catch (e) {
    return rejectWithValue(rejection(e, "Could not create the post."));
  }
});

export const editPost = createAsyncThunk<
  Partial<Post>,
  {
    id: string;
    text?: string;
    approvalChange?: "request" | "revert";
  } & SchedulePayload,
  RejectConfig
>("posts/edit", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch<{ post: Partial<Post> }>(
      `/api/buffer/posts/${encodeURIComponent(id)}`,
      body,
    );
    return data.post;
  } catch (e) {
    return rejectWithValue(rejection(e, "Could not save the changes."));
  }
});

export const schedulePost = createAsyncThunk<
  Partial<Post>,
  { id: string } & SchedulePayload,
  RejectConfig
>("posts/schedule", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{ post: Partial<Post> }>(
      `/api/buffer/posts/${encodeURIComponent(id)}/schedule`,
      body,
    );
    return data.post;
  } catch (e) {
    return rejectWithValue(rejection(e, "Could not schedule the draft."));
  }
});

export const deletePost = createAsyncThunk<string, string, RejectConfig>(
  "posts/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/api/buffer/posts/${encodeURIComponent(id)}`);
      return id;
    } catch (e) {
      return rejectWithValue(rejection(e, "Could not delete the post."));
    }
  },
);

export const repostPost = createAsyncThunk<
  { results: CreateResult[]; mediaReused: number },
  {
    id: string;
    targets: Target[];
    assets: Asset[];
    text: string;
  } & SchedulePayload,
  RejectConfig
>("posts/repost", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{
      results: CreateResult[];
      mediaReused: number;
    }>(`/api/buffer/posts/${encodeURIComponent(id)}/repost`, body);
    return data;
  } catch (e) {
    return rejectWithValue(rejection(e, "Could not repost."));
  }
});
