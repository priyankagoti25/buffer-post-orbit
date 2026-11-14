import { useConfirm } from "../../components/ConfirmModal";
import { useState } from "react";
import ConnectCard from "../../components/ConnectCard";
import Loading from "../../components/Loading";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import RateLimitMeter from "../../components/RateLimitMeter";
import SyncButton from "../../components/SyncButton";
import { useOverview } from "../../hooks/useOverview";
import { formatDateTime } from "../../lib/format";
import {
  disconnectBuffer,
  startBufferConnect,
} from "../../store/buffer/bufferService";
import { useAppDispatch } from "../../store/hooks";

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const { status, statusError, overview } = useOverview();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirm();

  async function disconnect() {
    const ok = await confirm({
      title: "Disconnect Buffer?",
      message:
        "Your posts in Buffer are not affected. You can connect again at any time.",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await dispatch(disconnectBuffer());
    setBusy(false);
    if (disconnectBuffer.rejected.match(res))
      setError(res.payload ?? "Unable to disconnect.");
  }

  async function reconnect() {
    setBusy(true);
    try {
      await startBufferConnect();
    } catch {
      setError("Unable to start the Buffer connection.");
      setBusy(false);
    }
  }

  const scopes = status?.scope?.split(/[\s,]+/).filter(Boolean) ?? [];

  return (
    <>
      {dialog}
      <>
        <PageHeader eyebrow="Settings" title="Connection & limits." />
        {statusError && !status && <Notice kind="error">{statusError}</Notice>}
        {!status && !statusError && <Loading />}
        {status && !status.connected && (
          <ConnectCard reauth={status.reauthRequired} />
        )}
        {status?.connected && (
          <div className="space-y-6">
            {error && <Notice kind="error">{error}</Notice>}
            <section className="card p-6">
              <h2 className="text-2xl">Buffer connection</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted">Connected</dt>
                  <dd className="font-medium">
                    {formatDateTime(status.connectedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Account</dt>
                  <dd className="font-medium">
                    {overview?.account.email ?? "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs font-medium text-muted">
                Permissions granted
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {scopes.map((s) => (
                  <span key={s} className="chip bg-sage-100 text-forest-800">
                    {s}
                  </span>
                ))}
              </div>
              {!scopes.includes("ideas:write") && (
                <p className="mt-3 text-xs text-muted">
                  To send ideas to Buffer, add{" "}
                  <code>ideas:read ideas:write</code> to BUFFER_SCOPES on the
                  server, then reconnect.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="btn btn-soft"
                  onClick={reconnect}
                  disabled={busy}
                >
                  Reconnect
                </button>
                <button
                  className="btn btn-danger"
                  onClick={disconnect}
                  disabled={busy}
                >
                  Disconnect
                </button>
              </div>
            </section>

            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl">Request limits</h2>
                <SyncButton small />
              </div>
              <p className="mb-4 mt-1 text-sm font-medium text-muted">
                Buffer limits how many requests this app can make. The limit is
                shared by everyone using the app.
              </p>
              <RateLimitMeter rateLimit={overview?.rateLimit ?? null} />
            </section>
          </div>
        )}
      </>
    </>
  );
}
