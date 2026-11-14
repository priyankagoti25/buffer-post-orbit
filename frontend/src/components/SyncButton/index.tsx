import { useState } from "react";
import { runSyncHandlers } from "../../lib/sync";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchOverview } from "../../store/buffer/bufferService";
import Icon from "../Icon";

/** Pulls fresh data from Buffer: the account first, then whatever the current page shows. */
export default function SyncButton({ small = false }: { small?: boolean }) {
  const dispatch = useAppDispatch();
  const connected = useAppSelector((s) => s.buffer.status?.connected);
  const [busy, setBusy] = useState(false);
  if (!connected) return null;

  async function sync() {
    if (busy) return;
    setBusy(true);
    try {
      await dispatch(fetchOverview({ refresh: true })); // first, so the page lists below see the current channels
      await runSyncHandlers();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`btn btn-soft ${small ? "btn-sm" : ""}`}
      onClick={() => void sync()}
      disabled={busy}
      aria-busy={busy}
    >
      <Icon
        name="refresh"
        className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
      />
      {busy ? "Syncing…" : "Sync with Buffer"}
    </button>
  );
}
