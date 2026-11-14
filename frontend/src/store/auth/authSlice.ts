import { createSlice } from "@reduxjs/toolkit";
import type { User } from "./authService";
import { logout, restoreSession } from "./authService";

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  initialized: boolean;
  loading: boolean;
};
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  initialized: false,
  loading: false,
};

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (s) => {
        s.loading = true;
      })
      .addCase(restoreSession.fulfilled, (s, a) => {
        s.loading = false;
        s.initialized = true;
        s.user = a.payload.user;
        s.isAuthenticated = true;
      })
      .addCase(restoreSession.rejected, (s) => {
        s.loading = false;
        s.initialized = true;
        s.user = null;
        s.isAuthenticated = false;
      })
      .addCase(logout.fulfilled, (s) => {
        s.user = null;
        s.isAuthenticated = false;
        s.initialized = true;
      });
  },
});
export default slice.reducer;
