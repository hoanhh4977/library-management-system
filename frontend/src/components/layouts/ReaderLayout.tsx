import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpenText,
  ClipboardText,
  List,
  MagnifyingGlass,
  SidebarSimple,
  SignOut,
} from "@phosphor-icons/react";

import { useLogout } from "../../hooks/useLogout";
import { useMe } from "../../hooks/useMe";
import { Avatar } from "../Avatar";
import { RefreshButton } from "../RefreshButton";
import { StatusBadge } from "../StatusBadge";
import { ThemeToggle } from "../ThemeToggle";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { PageHeaderProvider, usePageHeaderValue } from "./PageHeaderContext";

const READER_NAV = [
  { to: "/reader/search", label: "Tra cứu sách", icon: MagnifyingGlass },
  { to: "/reader/history", label: "Lịch sử mượn của tôi", icon: ClipboardText },
];

function Topbar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const header = usePageHeaderValue();
  const { data: me } = useMe();

  return (
    <header className="flex flex-none flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-4">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
        className="hidden rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted lg:flex"
      >
        <SidebarSimple size={18} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-xl font-semibold">{header?.title ?? ""}</h1>
        {header?.subtitle && <p className="truncate text-sm text-muted-foreground">{header.subtitle}</p>}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {me?.library_card && <StatusBadge status={me.library_card.status} />}
        <RefreshButton />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Reader shell — mirrors StaffLayout's collapsible sidebar (Bookary logo, nav rail,
 * avatar/logout footer) instead of the old two-tab topbar, so the reader-facing app
 * shares the same navigation language as the librarian/admin views (only the two
 * reader-scoped routes end up in the rail: tra cứu sách để gửi yêu cầu mượn, lịch sử
 * mượn để theo dõi phiếu và gửi yêu cầu gia hạn). */
export function ReaderLayout() {
  const { data: me } = useMe();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // See StaffLayout for why the page itself is locked while this layout is mounted:
  // Chromium mis-computes document scrollHeight with a sticky sidebar inside an
  // overflow-hidden ancestor otherwise, producing a phantom page-level scrollbar.
  useEffect(() => {
    const { documentElement } = document;
    const previousOverflow = documentElement.style.overflow;
    documentElement.style.overflow = "hidden";
    return () => {
      documentElement.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <PageHeaderProvider>
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <aside
          className={`sticky top-0 hidden h-dvh flex-none flex-col overflow-y-auto border-r border-border bg-sidebar py-5 transition-[width] lg:flex ${
            collapsed ? "w-20 px-2" : "w-64 px-3"
          }`}
        >
          <div className={`mb-8 flex items-center gap-2 text-accent ${collapsed ? "justify-center px-0" : "px-2"}`}>
            <BookOpenText size={26} weight="fill" aria-hidden="true" />
            {!collapsed && <span className="font-heading text-lg font-semibold">Bookary</span>}
          </div>

          {!collapsed && (
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-sidebar-muted-foreground">
              Menu chính
            </p>
          )}
          <nav className="flex flex-col gap-1">
            {READER_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
                      : "text-sidebar-foreground hover:bg-muted"
                  }`
                }
              >
                <Icon size={18} aria-hidden="true" />
                {!collapsed && label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void logout()}
              title={collapsed ? "Đăng xuất" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-muted ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <SignOut size={18} aria-hidden="true" />
              {!collapsed && "Đăng xuất"}
            </button>
            <NavLink
              to="/reader/account"
              title={collapsed ? "Tài khoản của tôi" : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl border p-2 transition-colors hover:bg-muted ${
                  collapsed ? "justify-center" : ""
                } ${isActive ? "border-accent bg-muted" : "border-border"}`
              }
            >
              <Avatar name={me?.full_name ?? "?"} />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{me?.full_name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{me?.code}</p>
                </div>
              )}
            </NavLink>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-none items-center gap-2 border-b border-border bg-card px-4 py-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Mở menu điều hướng"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
            >
              <List size={19} aria-hidden="true" />
            </button>
            <div className="flex items-center gap-1.5 text-accent">
              <BookOpenText size={20} weight="fill" aria-hidden="true" />
              <span className="font-heading text-sm font-semibold">Bookary</span>
            </div>
          </div>
          <Topbar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        items={READER_NAV}
        accountPath="/reader/account"
        meName={me?.full_name}
        meCode={me?.code}
        onLogout={() => void logout()}
      />
    </PageHeaderProvider>
  );
}
