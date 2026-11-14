import { createSlice, isFulfilled } from "@reduxjs/toolkit";
import type { BufferStatus, Overview } from "../../types/buffer";
import { logout } from "../auth/authService";
import {
  createPosts,
  deletePost,
  editPost,
  repostPost,
  schedulePost,
} from "../posts/postsService";
import {
  cancelRecurring,
  pauseRecurring,
  resumeRecurring,
  saveRecurring,
} from "../recurring/recurringService";
import { disconnectBuffer, fetchOverview, fetchStatus } from "./bufferService";
import { setTimeFormat } from "../../lib/format";

type BufferState = {
  status: BufferStatus | null;
  statusError: string | null;
  overview: Overview | null;
  overviewLoading: boolean;
  overviewError: string | null;
  /** Set after any write, so pages know the numbers on screen are out of date. */
  stale: boolean;
};

const initialState: BufferState = {
  status: null,
  statusError: null,
  overview: null,
  overviewLoading: false,
  overviewError: null,
  stale: false,
};

const slice = createSlice({
  name: "buffer",
  initialState,
  reducers: {
    markReauth: (s) => {
      s.status = {
        connected: false,
        reauthRequired: true,
        scope: s.status?.scope ?? null,
        connectedAt: s.status?.connectedAt ?? null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStatus.fulfilled, (s, a) => {
        s.status = a.payload;
        s.statusError = null;
      })
      .addCase(fetchStatus.rejected, (s, a) => {
        s.statusError =
          a.payload ?? "Could not load the Buffer connection status.";
      })
      .addCase(fetchOverview.pending, (s) => {
        s.overviewLoading = true;
        s.overviewError = null;
      })
      .addCase(fetchOverview.fulfilled, (s, a) => {
        s.overviewLoading = false;
        s.overview = a.payload;
        s.stale = false;
        setTimeFormat(a.payload.account?.preferences?.timeFormat);
      })
      .addCase(fetchOverview.rejected, (s, a) => {
        s.overviewLoading = false;
        s.overviewError = a.payload ?? "Could not load your Buffer data.";
      })
      .addCase(disconnectBuffer.fulfilled, () => ({
        ...initialState,
        status: {
          connected: false,
          reauthRequired: false,
          scope: null,
          connectedAt: null,
        },
      }))
      .addCase(logout.fulfilled, () => initialState)
      .addMatcher(
        isFulfilled(
          createPosts,
          editPost,
          schedulePost,
          deletePost,
          repostPost,
          saveRecurring,
          pauseRecurring,
          resumeRecurring,
          cancelRecurring,
        ),
        (s) => {
          s.stale = true;
        },
      );
  },
});

export const { markReauth } = slice.actions;
export default slice.reducer;
