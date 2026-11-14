import { Link } from "react-router-dom";
import BufferGate from "../../components/BufferGate";
import ChannelAvatar from "../../components/ChannelAvatar";
import CountGrid from "../../components/CountGrid";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import SyncButton from "../../components/SyncButton";
import { getService } from "../../lib/channels";
import { formatDate } from "../../lib/format";
import type { Overview } from "../../types/buffer";

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Account({ overview }: { overview: Overview }) {
  const a = overview.account;
  const prefs = Object.entries(a.preferences ?? {});
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center gap-4">
        <ChannelAvatar
          src={a.avatar}
          name={a.name || a.email}
          service=""
          size={56}
        />
        <div className="min-w-0">
          <h2 className="text-2xl text-forest-900">
            {a.name || "Your account"}
          </h2>
          <p className="text-sm text-forest-800">{a.email}</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Time zone", a.timezone],
          ["Backup email", a.backupEmail],
          ["Member since", a.createdAt ? formatDate(a.createdAt) : null],
          ...prefs.map(
            ([k, v]) =>
              [
                k
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase()),
                v,
              ] as [string, unknown],
          ),
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt className="text-xs font-semibold text-muted">{String(k)}</dt>
            <dd className="font-medium">{show(v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Your Buffer, in one place"
        subtitle="Account, organizations, channels and every post status, organized and up to date"
        actions={<SyncButton />}
      />
      <BufferGate>
        {({ overview }) => (
          <div className="space-y-8">
            {overview.warnings.map((w) => (
              <Notice key={w} kind="warning">
                {w}
              </Notice>
            ))}
            <Account overview={overview} />

            {overview.organizations.map((org) => (
              <section key={org.id} className="space-y-4">
                <div className="rounded-3xl bg-mist-200 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="label-eyebrow">Organization</p>
                      <h2 className="mt-1 text-3xl text-forest-900">
                        {org.name}
                      </h2>
                      <p className="mt-1 text-sm text-forest-800">
                        {org.ownerEmail ? `Owner: ${org.ownerEmail} · ` : ""}
                        {org.members
                          ? `${org.members.totalCount} member${org.members.totalCount === 1 ? "" : "s"} · `
                          : ""}
                        {org.channelCount} channel
                        {org.channelCount === 1 ? "" : "s"}
                        {org.shouldEnforce2FASetup ? " · 2FA required" : ""}
                      </p>
                    </div>
                  </div>
                  {org.limits && Object.keys(org.limits).length > 0 && (
                    <dl className="mt-4 flex flex-wrap gap-2 text-xs">
                      {Object.entries(org.limits).map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded-full bg-white/70 px-3 py-1"
                        >
                          <dt className="inline font-semibold text-muted">
                            {k.replace(/([A-Z])/g, " $1").toLowerCase()}:{" "}
                          </dt>
                          <dd className="inline font-medium">{v ?? "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-4">
                    <CountGrid
                      counts={org.counts}
                      sentPartial={overview.sentCountIsPartial}
                    />
                  </div>
                  {org.pendingTruncated && (
                    <p className="mt-2 text-xs text-forest-800">
                      Large organization: queue and draft counts may be slightly
                      low.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {org.channels.map((c) => {
                    const info = getService(c.service);
                    return (
                      <Link
                        key={c.id}
                        to={`/channels/${c.id}`}
                        className="card block p-5 transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <ChannelAvatar
                            src={c.avatar}
                            name={c.displayName || c.name}
                            service={c.service}
                            size={44}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {c.displayName || c.name}
                            </p>
                            <p className="text-xs font-semibold text-muted">
                              {info.label}
                              {c.type ? ` · ${c.type}` : ""}
                            </p>
                          </div>
                          {c.isDisconnected && (
                            <span className="chip bg-red-100 text-red-800">
                              Disconnected
                            </span>
                          )}
                          {c.isQueuePaused && (
                            <span className="chip bg-sand-100 text-sand-700">
                              Queue paused
                            </span>
                          )}
                          {c.isLocked && (
                            <span className="chip bg-stone-100 text-stone-700">
                              Locked
                            </span>
                          )}
                        </div>
                        <div className="mt-4">
                          <CountGrid
                            counts={c.counts}
                            sentPartial={overview.sentCountIsPartial}
                            dense
                          />
                        </div>
                      </Link>
                    );
                  })}
                  {org.channels.length === 0 && (
                    <p className="text-sm text-muted">
                      No channels connected in this organization.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </BufferGate>
    </>
  );
}
