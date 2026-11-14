import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import type { Asset, Idea } from "../../types/buffer";

type Cfg = { rejectValue: string };
type IdeaBody = {
  title: string;
  text: string;
  contentJson: Record<string, unknown> | null;
  assets: Asset[];
};

export type IdeasResult = { ideas: Idea[]; bufferError: string | null };

/** `refresh` skips the one-minute cache and asks Buffer again. */
export const fetchIdeas = createAsyncThunk<
  IdeasResult,
  { refresh?: boolean } | undefined,
  Cfg
>("ideas/list", async (arg, { rejectWithValue }) => {
  try {
    const { data } = await api.get<IdeasResult>("/api/buffer/ideas", {
      params: arg?.refresh ? { refresh: 1 } : undefined,
    });
    return data;
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Could not load ideas."));
  }
});

export const createIdea = createAsyncThunk<
  Idea,
  IdeaBody & { organizationId?: string; syncToBuffer?: boolean },
  Cfg
>("ideas/create", async (input, { rejectWithValue }) => {
  try {
    const { data } = await api.post<{ idea: Idea }>("/api/buffer/ideas", input);
    return data.idea;
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Could not save the idea."));
  }
});

export const updateIdea = createAsyncThunk<
  Idea,
  { id: string } & IdeaBody,
  Cfg
>("ideas/update", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch<{ idea: Idea }>(
      `/api/buffer/ideas/${id}`,
      body,
    );
    return data.idea;
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Could not save the idea."));
  }
});

export const deleteIdea = createAsyncThunk<string, string, Cfg>(
  "ideas/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/api/buffer/ideas/${id}`);
      return id;
    } catch (e) {
      return rejectWithValue(errorMessage(e, "Could not delete the idea."));
    }
  },
);
