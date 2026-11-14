import { Link, NavLink, useNavigate } from "react-router-dom";
import { useOverview } from "../../hooks/useOverview";
import { logout } from "../../store/auth/authService";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import ChannelAvatar from "../ChannelAvatar";
import Icon, { type IconName } from "../Icon";
import Logo from "../Logo";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/dashboard", label: "Overview", icon: "home" },
  { to: "/posts", label: "Posts", icon: "list" },
  { to: "/recurring", label: "Recurring", icon: "repeat" },
  { to: "/ideas", label: "Ideas", icon: "bulb" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-[0.8rem] font-medium transition-colors ${
    isActive ? "bg-sage-200 text-forest-900" : "text-ink hover:bg-sage-50"
  }`;

/** Everything a signed-in person sees. Loads the Buffer overview so channels can be listed. */
function SignedInNav({ onNavigate }: { onNavigate?: () => void }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { overview } = useOverview();
  const orgs = overview?.organizations ?? [];

  return (
    <>
      <nav aria-label="Main" className=" shrink-0 space-y-1 px-4">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={linkClass}
            onClick={onNavigate}
          >
            <Icon name={item.icon} className="h-[1.15rem] w-[1.15rem]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {orgs.some((o) => o.channels.length > 0) && (
        <nav
          aria-label="Channels"
          className="mt-4 flex min-h-0 flex-1 flex-col px-4"
        >
          <p className="label-eyebrow shrink-0 px-3">Channels</p>
          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {orgs.map((org) => (
              <div key={org.id}>
                {orgs.length > 1 && (
                  <p className="px-3 pb-1 text-xs font-medium text-muted">
                    {org.name}
                  </p>
                )}
                <div className="space-y-0.5">
                  {org.channels.map((c) => {
                    const pending = c.counts.queue;
                    return (
                      <NavLink
                        key={c.id}
                        to={`/channels/${c.id}`}
                        className={linkClass}
                        onClick={onNavigate}
                      >
                        <ChannelAvatar
                          src={c.avatar}
                          name={c.displayName || c.name}
                          service={c.service}
                          size={28}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {c.displayName || c.name}
                        </span>
                        {c.isDisconnected && (
                          <span
                            className="h-2 w-2 rounded-full bg-red-500"
                            title="Disconnected"
                            aria-label="Disconnected"
                          />
                        )}
                        {pending > 0 && (
                          <span className="chip bg-sage-100 text-forest-800">
                            {pending}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}

      <div className="mt-auto shrink-0 border-t border-line pt-3 pb-1 px-2">
        <div className="flex items-center gap-3 px-2 pb-3">
          <ChannelAvatar
            src={user?.avatar}
            name={user?.name ?? "?"}
            service=""
            size={36}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            {/* <p className="truncate text-xs font-semibold text-muted">
              {user?.email}
            </p> */}
          </div>
        </div>
        <button
          className="btn btn-ghost w-full justify-start gap-3"
          onClick={async () => {
            await dispatch(logout());
            navigate("/");
          }}
        >
          <Icon name="logout" className="h-[1.1rem] w-[1.1rem]" /> Log out
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated, initialized } = useAppSelector((s) => s.auth);
  return (
    <div className="flex h-full flex-col overflow-hidden pb-2">
      <div className="shrink-0 px-6 py-4">
        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          onClick={onNavigate}
          aria-label="PostOrbit home"
        >
          <Logo />
        </Link>
      </div>
      {!initialized ? null : isAuthenticated ? (
        <SignedInNav onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}
