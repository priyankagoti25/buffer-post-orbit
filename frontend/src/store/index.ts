import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import bufferReducer, { markReauth } from "./buffer/bufferSlice";
import ideasReducer from "./ideas/ideasSlice";
import postsReducer from "./posts/postsSlice";
import recurringReducer from "./recurring/recurringSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    buffer: bufferReducer,
    posts: postsReducer,
    ideas: ideasReducer,
    recurring: recurringReducer,
  },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

if (typeof window !== "undefined")
  window.addEventListener("buffer-reauth", () => store.dispatch(markReauth()));
