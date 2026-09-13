import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  BookOpenText,
  ChartBar,
  ClipboardText,
  ClockCounterClockwise,
  Tray,
  MagnifyingGlass,
  SidebarSimple,
  SignOut,
  UsersThree,
  IdentificationCard,
} from "@phosphor-icons/react";

import { useLogout } from "../../hooks/useLogout";
import { useMe } from "../../hooks/useMe";
import { Avatar } from "../Avatar";
import { RefreshButton } from "../RefreshButton";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationBell } from "../NotificationBell";
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
  { to: "/librarian/books", label: "Quản lý Sách", icon: BookOpen },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/dashboard", label: "Tổng quan", icon: ChartBar },
  { to: "/admin/activities", label: "Hoạt động thư viện", icon: ClockCounterClockwise },
  { to: "/admin/requests", label: "Xử lý yêu cầu", icon: Tray },
  { to: "/admin/books", label: "Quản lý Sách", icon: BookOpen },
  { to: "/admin/unlock-requests", label: "Yêu cầu mở khóa thẻ", icon: IdentificationCard },
  { to: "/admin/people", label: "Độc giả & Nhân viên", icon: UsersThree },
];

/** DOM-uncontrolled text input: React never rewrites `.value` on its own render
 * (only when `value` changes from something OTHER than this input's own typing —
 * see the ref-diff check below). A plain `value={...}` controlled input here forces
 * a full state→effect→context→re-render round trip through PageHeaderContext on
 * every keystroke; that extra indirection was racing the browser's handling of
 * precomposed Vietnamese diacritics and silently dropping characters (confirmed by
 * comparing against a plain uncontrolled input, which never dropped anything). */
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.value !== value) {
      ref.current.value = value;
    }
  }, [value]);

  return (
    <input
      ref={ref}
      defaultValue={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Tìm kiếm…"}
      className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
    />
  );
}

/** Topbar: page title/subtitle (from PageHeaderContext) on the left, an optional
 * search box in the middle, theme toggle + optional CTA on the right — ref: Bookary. */
function Topbar({
  collapsed,
  onToggleCollapsed,
  role,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  role: "librarian" | "admin";
}) {
  const header = usePageHeaderValue();

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
          <SearchInput
            value={header.search.value}
            onChange={header.search.onChange}
            placeholder={header.search.placeholder}
          />
        </label>
      )}

      <div className="ml-auto flex items-center gap-3">
        <RefreshButton />
        <ThemeToggle />
        <NotificationBell role={role} />
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

  // Chromium mis-computes document.documentElement's scrollHeight when a
  // `position: sticky` descendant (the sidebar) sits inside an `overflow-hidden`
  // ancestor — the page becomes scrollable by a phantom amount even though every
  // pixel of real content is already contained by <main>'s own scroll. Locking the
  // page itself while this layout is mounted keeps only <main>/<aside> scrollable,
  // matching the rest of the shell's single-scroll-region design.
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
            <NavLink
              to={`/${role}/account`}
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
          <nav className="flex flex-none gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
            {items.map(({ to, label }) => (
              <NavLink key={to} to={to} className="flex-none text-sm text-muted-foreground">
                {label}
              </NavLink>
            ))}
          </nav>
          <Topbar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} role={role} />
          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
