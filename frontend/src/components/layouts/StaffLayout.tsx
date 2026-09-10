import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  BookOpenText,
  ChartBar,
  ClipboardText,
  Tray,
  MagnifyingGlass,
  SidebarSimple,
  SignOut,
  UsersThree,
  IdentificationCard,
} from "@phosphor-icons/react";

import { useLogout } from "../../hooks/useLogout";
import { useMe } from "../../hooks/useMe";
import { ThemeToggle } from "../ThemeToggle";
import { PageHeaderProvider, usePageHeaderValue } from "./PageHeaderContext";

interface NavItem {
  to: string;
  label: string;
  icon: typeof BookOpen;
}

const LIBRARIAN_NAV: NavItem[] = [
  { to: "/librarian/counter", label: "Quầy giao dịch", icon: ClipboardText },
  { to: "/librarian/requests", label: "Yêu cầu từ độc giả", icon: Tray },
  { to: "/librarian/readers", label: "Độc giả", icon: UsersThree },
  { to: "/librarian/search", label: "Tra cứu sách", icon: MagnifyingGlass },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/dashboard", label: "Tổng quan", icon: ChartBar },
  { to: "/admin/books", label: "Quản lý Sách", icon: BookOpen },
  { to: "/admin/unlock-requests", label: "Yêu cầu mở khóa thẻ", icon: IdentificationCard },
  { to: "/admin/people", label: "Độc giả & Nhân viên", icon: UsersThree },
];

/** Topbar: page title/subtitle (from PageHeaderContext) on the left, an optional
 * search box in the middle, theme toggle + optional CTA on the right — ref: Bookary. */
function Topbar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const header = usePageHeaderValue();

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-4">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
        className="hidden rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted lg:flex"
      >
        <SidebarSimple size={18} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-none">
        <h1 className="truncate font-heading text-xl font-semibold">{header?.title ?? ""}</h1>
        {header?.subtitle && <p className="truncate text-sm text-muted-foreground">{header.subtitle}</p>}
      </div>

      {header?.search && (
        <label className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={header.search.value}
            onChange={(e) => header.search?.onChange(e.target.value)}
            placeholder={header.search.placeholder ?? "Tìm kiếm…"}
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
      )}

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {header?.action}
      </div>
    </header>
  );
}

/** Librarian/Admin shell — ref: Bookary. White sidebar (the active nav item alone
 * carries the solid forest-green pill), collapsible to icon rail, shared topbar. */
export function StaffLayout({ role }: { role: "librarian" | "admin" }) {
  const { data: me } = useMe();
  const logout = useLogout();
  const [collapsed, setCollapsed] = useState(false);
  const items = role === "librarian" ? LIBRARIAN_NAV : ADMIN_NAV;

  return (
    <PageHeaderProvider>
      <div className="flex min-h-dvh bg-background text-foreground">
        <aside
          className={`hidden flex-none flex-col border-r border-border bg-sidebar py-5 transition-[width] lg:flex ${
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
            {items.map(({ to, label, icon: Icon }) => (
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
            <div className={`flex items-center gap-2.5 rounded-xl border border-border p-2 ${collapsed ? "justify-center" : ""}`}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {me?.full_name?.charAt(0).toUpperCase() ?? "?"}
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{me?.full_name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{me?.code}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <nav className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
            {items.map(({ to, label }) => (
              <NavLink key={to} to={to} className="flex-none text-sm text-muted-foreground">
                {label}
              </NavLink>
            ))}
          </nav>
          <Topbar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
          <main className="min-w-0 flex-1 px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
