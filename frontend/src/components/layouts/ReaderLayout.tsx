import { NavLink, Outlet } from "react-router-dom";
import { BookOpenText, ClipboardText, MagnifyingGlass, SignOut } from "@phosphor-icons/react";

import { useLogout } from "../../hooks/useLogout";
import { useMe } from "../../hooks/useMe";
import { Avatar } from "../Avatar";
import { ThemeToggle } from "../ThemeToggle";
import { PageHeaderProvider, usePageHeaderValue } from "./PageHeaderContext";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-sidebar-active text-sidebar-active-foreground" : "text-muted-foreground hover:bg-muted"
  }`;

function ReaderTitleBar() {
  const header = usePageHeaderValue();
  return (
    <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <h1 className="font-heading text-xl font-semibold">{header?.title ?? ""}</h1>
      {header?.subtitle && <p className="text-sm text-muted-foreground">{header.subtitle}</p>}
    </div>
  );
}

/** Reader shell: two tabs only, no sidebar — per MASTER.md "Điều hướng theo vai trò".
 * Still shares the Bookary topbar language (logo, pill nav, theme toggle) with StaffLayout. */
export function ReaderLayout() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <PageHeaderProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-accent">
            <BookOpenText size={24} weight="fill" aria-hidden="true" />
            <span className="font-heading text-lg font-semibold">Bookary</span>
          </div>

          <nav className="ml-2 flex gap-1">
            <NavLink to="/reader/search" className={tabClass}>
              <MagnifyingGlass size={16} aria-hidden="true" />
              Tra cứu sách
            </NavLink>
            <NavLink to="/reader/history" className={tabClass}>
              <ClipboardText size={16} aria-hidden="true" />
              Lịch sử mượn của tôi
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar name={me?.full_name ?? "?"} size="sm" />
              <span className="hidden text-sm font-medium sm:inline">{me?.full_name}</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-1 rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="Đăng xuất"
            >
              <SignOut size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <ReaderTitleBar />

        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </PageHeaderProvider>
  );
}
