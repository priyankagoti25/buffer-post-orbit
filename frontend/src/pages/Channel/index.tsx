import { Link, useParams } from "react-router-dom";
import BufferGate from "../../components/BufferGate";
import ChannelAvatar from "../../components/ChannelAvatar";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import PostsBrowser from "../../components/PostsBrowser";
import SyncButton from "../../components/SyncButton";
import { getService } from "../../lib/channels";
import { formatDate } from "../../lib/format";

export default function ChannelPage() {
  const { channelId = "" } = useParams();
  return (
    <BufferGate>
      {({ overview }) => {
        const channel = overview.organizations
          .flatMap((o) => o.channels)
          .find((c) => c.id === channelId);
        if (!channel)
          return (
            <Notice kind="error">
              Channel not found.{" "}
              <Link className="underline" to="/dashboard">
                Back to overview
              </Link>
            </Notice>
          );
        const info = getService(channel.service);
        const facts: [string, string][] = [
          ["Network", info.label],
          ["Type", channel.type ?? "—"],
          ["Time zone", channel.timezone ?? "—"],
          [
            "Connected",
            channel.createdAt ? formatDate(channel.createdAt) : "—",
          ],
          ["Queue", channel.isQueuePaused ? "Paused" : "Running"],
          [
            "Status",
            channel.isDisconnected
              ? "Disconnected"
              : channel.isLocked
                ? "Locked"
                : "Active",
          ],
        ];
        return (
          <>
            <PageHeader
              eyebrow="Channel"
              title={channel.displayName || channel.name}
              actions={
                <>
                  <SyncButton />
                  {channel.externalLink && (
                    <a
                      className="btn btn-soft"
                      href={channel.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open profile
                    </a>
                  )}
                  <Link
                    className="btn btn-primary"
                    to={`/create?channel=${channel.id}`}
                  >
                    New post
                  </Link>
                </>
              }
            />
            <div className="card mb-8 flex flex-wrap items-center gap-6 p-5">
              <ChannelAvatar
                src={channel.avatar}
                name={channel.displayName || channel.name}
                service={channel.service}
                size={56}
              />
              <dl className="grid flex-1 grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PostsBrowser
              organizations={overview.organizations}
              channelId={channel.id}
            />
          </>
        );
      }}
    </BufferGate>
  );
}
