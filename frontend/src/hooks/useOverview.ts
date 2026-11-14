import { useCallback, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchOverview, fetchStatus } from "../store/buffer/bufferService";
import type { Channel } from "../types/buffer";

/**
 * Gives a page the Buffer overview (account, organizations, channels, counts).
 * It loads once, and again only after a write made the numbers stale.
 * A failed load is NOT retried automatically, so an error cannot cause a request loop.
 */
export function useOverview() {
  const dispatch = useAppDispatch();
  const {
    status,
    statusError,
    overview,
    overviewLoading,
    overviewError,
    stale,
  } = useAppSelector((s) => s.buffer);

  useEffect(() => {
    if (!status && !statusError) void dispatch(fetchStatus());
  }, [dispatch, status, statusError]);

  useEffect(() => {
    if (!status?.connected || overviewLoading || overviewError) return;
    if (!overview || stale)
      void dispatch(fetchOverview(overview ? { refresh: true } : undefined));
  }, [
    dispatch,
    status?.connected,
    overview,
    stale,
    overviewLoading,
    overviewError,
  ]);

  const reload = useCallback(
    () => dispatch(fetchOverview({ refresh: true })),
    [dispatch],
  );

  const channels = useMemo<Channel[]>(
    () => overview?.organizations.flatMap((o) => o.channels) ?? [],
    [overview],
  );

  return {
    status,
    statusError,
    overview,
    channels,
    loading:
      overviewLoading || (!!status?.connected && !overview && !overviewError),
    error: overviewError,
    reload,
  };
}
