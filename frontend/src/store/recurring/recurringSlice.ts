import { createSlice } from "@reduxjs/toolkit";
import type { RecurringSeries } from "../../types/buffer";
import { logout } from "../auth/authService";
import {
  cancelRecurring,
  fetchRecurring,
  pauseRecurring,
  resumeRecurring,
  saveRecurring,
} from "./recurringService";

type State = {
  items: RecurringSeries[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};
const initialState: State = {
  items: [],
  loaded: false,
  loading: false,
  error: null,
};

const upsert = (s: State, x: RecurringSeries) => {
  const i = s.items.findIndex((y) => y.id === x.id);
  if (i >= 0) s.items[i] = x;
  else s.items.unshift(x);
};

const slice = createSlice({
  name: "recurring",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchRecurring.pending, (s, a) => {
      if (a.meta.arg?.quiet) return;
      s.loading = true;
      s.error = null;
    })
      .addCase(fetchRecurring.fulfilled, (s, a) => {
        s.loading = false;
        s.loaded = true;
        s.items = a.payload;
      })
      .addCase(fetchRecurring.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload ?? "Could not load recurring posts.";
      })
      .addCase(saveRecurring.fulfilled, (s, a) =>
        a.payload.forEach((x) => upsert(s, x)),
      )
      .addCase(pauseRecurring.fulfilled, (s, a) => upsert(s, a.payload))
      .addCase(resumeRecurring.fulfilled, (s, a) => upsert(s, a.payload))
      .addCase(cancelRecurring.fulfilled, (s, a) => {
        s.items = s.items.filter((x) => x.id !== a.payload.id);
      })
      .addCase(logout.fulfilled, () => initialState);
  },
});
export default slice.reducer;
