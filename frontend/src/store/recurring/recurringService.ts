import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import type { RecurrencePayload } from "../../lib/schedule";
import type { Asset, RecurringSeries, Target } from "../../types/buffer";

type Cfg = { rejectValue: string };
export type SeriesInput = RecurrencePayload & {
  name: string;
  text: string;
  assets: Asset[];
  targets: Target[];
  sourcePostId?: string | null;
};

/** `quiet` is the background check while the page is open: our database only, no spinner, no error banner. */
export const fetchRecurring = createAsyncThunk<
  RecurringSeries[],
  { quiet?: boolean } | undefined,
  Cfg
>("recurring/list", async (arg, { rejectWithValue }) => {
  try {
    const { data } = await api.get<{ series: RecurringSeries[] }>(
      "/api/buffer/recurring",
      { params: arg?.quiet ? { watch: 1 } : undefined },
    );
    return data.series;
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Could not load recurring posts."));
  }
});

export const saveRecurring = createAsyncThunk<
  RecurringSeries[],
  { id?: string; body: SeriesInput },
  Cfg
>("recurring/save", async ({ id, body }, { rejectWithValue }) => {
  try {
    if (id) {
      const { data } = await api.put<{ series: RecurringSeries }>(
        `/api/buffer/recurring/${id}`,
        body,
      );
      return [data.series];
    }
    const { data } = await api.post<{ series: RecurringSeries[] }>(
      "/api/buffer/recurring",
      body,
    );
    return data.series;
  } catch (e) {
    return rejectWithValue(
      errorMessage(e, "Could not save the recurring post."),
    );
  }
});

export const pauseRecurring = createAsyncThunk<RecurringSeries, string, Cfg>(
  "recurring/pause",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post<{ series: RecurringSeries }>(
        `/api/buffer/recurring/${id}/pause`,
      );
      return data.series;
    } catch (e) {
      return rejectWithValue(errorMessage(e, "Could not pause."));
    }
  },
);

export const resumeRecurring = createAsyncThunk<RecurringSeries, string, Cfg>(
  "recurring/resume",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post<{ series: RecurringSeries }>(
        `/api/buffer/recurring/${id}/resume`,
      );
      return data.series;
    } catch (e) {
      return rejectWithValue(errorMessage(e, "Could not resume."));
    }
  },
);

export const cancelRecurring = createAsyncThunk<
  { id: string; warning?: string },
  string,
  Cfg
>("recurring/cancel", async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.delete<{ warning?: string }>(
      `/api/buffer/recurring/${id}`,
    );
    return { id, warning: data.warning };
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Could not cancel."));
  }
});
