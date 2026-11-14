import { useEffect, useRef } from "react";
import { registerSync } from "../lib/sync";

/** Tell the "Sync with Buffer" button how to refresh this page's data. */
export function useSyncHandler(handler: () => Promise<unknown> | void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => registerSync(() => latest.current()), []);
}
