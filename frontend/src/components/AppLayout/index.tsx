import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Icon from "../Icon";
import Logo from "../Logo";
import Sidebar from "../Sidebar";

/** Sidebar on the left, page on the right. On small screens the sidebar slides in. */
export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-paper lg:block">
        <Sidebar />
      </aside>

      {/* Phones and tablets only: a slim bar that holds the menu button. Desktop has no top bar. */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-cream/90 px-4 py-2 backdrop-blur lg:hidden">
        <button
          className="btn btn-ghost h-10 w-10 p-0"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <Logo />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-forest-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-paper shadow-xl">
            <button
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted hover:bg-sage-50"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-12">
        <Outlet />
      </main>
    </div>
  );
}
