import { useEffect } from "react";
import { RECURRING_LIMIT } from "../lib/recurrence";
import { fetchRecurring } from "../store/recurring/recurringService";
import { useAppDispatch, useAppSelector } from "../store/hooks";

/** How many recurring posts the account has (running or paused), and whether the limit is reached. */
export function useRecurringLimit(load = false) {
  const dispatch = useAppDispatch();
  const { items, loaded, loading, error } = useAppSelector((s) => s.recurring);

  useEffect(() => {
    if (load && !loaded && !loading && !error) void dispatch(fetchRecurring());
  }, [load, loaded, loading, error, dispatch]);

  const used = items.filter(
    (s) => s.status === "active" || s.status === "paused",
  ).length;
  return {
    loaded,
    used,
    left: Math.max(0, RECURRING_LIMIT - used),
    full: loaded && used >= RECURRING_LIMIT,
  };
}
