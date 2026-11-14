import { createSlice } from "@reduxjs/toolkit";
import type { Idea } from "../../types/buffer";
import { logout } from "../auth/authService";
import { createIdea, deleteIdea, fetchIdeas, updateIdea } from "./ideasService";

type IdeasState = {
  items: Idea[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  bufferError: string | null;
};
const initialState: IdeasState = {
  items: [],
  loaded: false,
  loading: false,
  error: null,
  bufferError: null,
};

const slice = createSlice({
  name: "ideas",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchIdeas.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchIdeas.fulfilled, (s, a) => {
        s.loading = false;
        s.loaded = true;
        s.items = a.payload.ideas;
        s.bufferError = a.payload.bufferError;
      })
      .addCase(fetchIdeas.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload ?? "Could not load ideas.";
      })
      .addCase(createIdea.fulfilled, (s, a) => {
        s.items.unshift(a.payload);
      })
      .addCase(updateIdea.fulfilled, (s, a) => {
        const i = s.items.findIndex((x) => x.id === a.payload.id);
        if (i >= 0) s.items[i] = a.payload;
      })
      .addCase(deleteIdea.fulfilled, (s, a) => {
        s.items = s.items.filter((x) => x.id !== a.payload);
      })
      .addCase(logout.fulfilled, () => initialState);
  },
});

export default slice.reducer;
