/**
 * Every page that shows Buffer data registers a function here. The "Sync with Buffer" button
 * runs them all, so each page decides for itself what "sync" means for its own data.
 */
type Handler = () => Promise<unknown> | void;
const handlers = new Set<Handler>();

export function registerSync(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export const runSyncHandlers = () =>
  Promise.allSettled([...handlers].map((h) => h()));
