import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import type { BufferStatus, Overview } from "../../types/buffer";

export const fetchStatus = createAsyncThunk<
  BufferStatus,
  void,
  { rejectValue: string }
>("buffer/status", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<BufferStatus>("/api/buffer/status");
    return data;
  } catch (e) {
    return rejectWithValue(
      errorMessage(e, "Could not load the Buffer connection status."),
    );
  }
});

/** Account, organizations, channels and post counts in one call. The server caches it for 60 seconds. */
export const fetchOverview = createAsyncThunk<
  Overview,
  { refresh?: boolean } | undefined,
  { rejectValue: string }
>("buffer/overview", async (opts, { rejectWithValue }) => {
  try {
    const { data } = await api.get<Overview>("/api/buffer/overview", {
      params: opts?.refresh ? { refresh: 1 } : undefined,
    });
    return data;
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Could not load your Buffer data."));
  }
});

export const disconnectBuffer = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("buffer/disconnect", async (_, { rejectWithValue }) => {
  try {
    await api.delete("/api/buffer/connection");
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Unable to disconnect."));
  }
});

/** Asks the server for Buffer's sign-in address, then sends the browser there. */
export async function startBufferConnect(): Promise<void> {
  const { data } = await api.post<{ url: string }>("/api/buffer/connect");
  location.assign(data.url);
}
