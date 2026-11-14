import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  api,
  exchangeLoginCode,
  refreshSession,
  setAccessToken,
} from "../../lib/api";

export type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

/** Sign-in happens through Buffer. After Buffer sends the person back, the server has set a cookie and this picks it up. */
export const restoreSession = createAsyncThunk(
  "auth/restore",
  async (_, { rejectWithValue }) => {
    // Coming back from Buffer: the URL holds a one-time code. Otherwise use the refresh cookie.
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    let session = code ? await exchangeLoginCode(code) : null;
    if (code) {
      url.searchParams.delete("code");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    session ??= await refreshSession();
    return session ?? rejectWithValue("No active session");
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  try {
    await api.post("/api/auth/logout");
  } catch {
    /* Local logout still clears the in-memory access token. */
  } finally {
    setAccessToken(null);
  }
});
