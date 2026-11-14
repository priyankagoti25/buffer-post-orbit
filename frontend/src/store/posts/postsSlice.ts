import { createSlice, isFulfilled } from "@reduxjs/toolkit";
import { logout } from "../auth/authService";
import {
  createPosts,
  deletePost,
  editPost,
  repostPost,
  schedulePost,
} from "./postsService";
import {
  cancelRecurring,
  pauseRecurring,
  resumeRecurring,
  saveRecurring,
} from "../recurring/recurringService";

/**
 * `version` goes up after every successful write. Lists on screen watch it and reload,
 * so a deleted or moved post disappears without a manual refresh.
 */
const slice = createSlice({
  name: "posts",
  initialState: { version: 0 },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => ({ version: 0 }))
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
          s.version += 1;
        },
      );
  },
});

export default slice.reducer;
