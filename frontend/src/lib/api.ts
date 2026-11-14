import axios from "axios";
// Local: the backend on port 4000. Production: empty, so calls go to the same site and the host forwards /api to the backend.
export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:4000" : "");
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export type SessionData = {
  user: { id: string; name: string; email: string; avatar?: string | null };
  accessToken: string;
};

/**
 * Ask the server for a new access token using the refresh cookie.
 * Every refresh token works only once, so two requests at the same moment (React StrictMode runs
 * effects twice in development, and several API calls can fail together) must share ONE request.
 */
let refreshPromise: Promise<SessionData | null> | null = null;
export function refreshSession(): Promise<SessionData | null> {
  refreshPromise ??= api
    .post<SessionData>("/api/auth/refresh")
    .then((r) => {
      setAccessToken(r.data.accessToken);
      return r.data;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

/** Swap the one-time code from the Buffer redirect for a session. Shared, because StrictMode asks twice. */
const exchanges = new Map<string, Promise<SessionData | null>>();
export function exchangeLoginCode(code: string): Promise<SessionData | null> {
  let p = exchanges.get(code);
  if (!p) {
    p = api
      .post<SessionData>("/api/auth/exchange", { code })
      .then((r) => {
        setAccessToken(r.data.accessToken);
        return r.data;
      })
      .catch(() => null);
    exchanges.set(code, p);
  }
  return p;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !String(original.url).includes("/auth/refresh")
    ) {
      original._retry = true;
      const session = await refreshSession();
      if (session) {
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      }
    }
    // Buffer says the connection cannot be renewed: tell the app so it shows "Reconnect Buffer" right away.
    const code =
      error.response?.data?.error?.code ?? error.response?.data?.code;
    if (code === "BUFFER_REAUTH_REQUIRED")
      window.dispatchEvent(new Event("buffer-reauth"));
    return Promise.reject(error);
  },
);
