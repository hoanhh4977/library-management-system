import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { BookOpenText, SignOut, X, type Icon } from "@phosphor-icons/react";

import { Avatar } from "../Avatar";

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

/** Full-height slide-in drawer holding the same nav the desktop sidebar shows —
 * on mobile the sidebar is hidden entirely (`lg:flex`), so without this there was
 * no way to reach any page except the current one (only a thin, easy-to-miss text
 * link row existed before). Shared by StaffLayout and ReaderLayout. */
export function MobileNavDrawer({
  open,
  onClose,
  items,
  accountPath,
  meName,
  meCode,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  accountPath: string;
  meName?: string;
  meCode?: string;
  onLogout: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Đóng menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col overflow-y-auto bg-sidebar px-3 py-5 shadow-xl">
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-accent">
            <BookOpenText size={24} weight="fill" aria-hidden="true" />
            <span className="font-heading text-lg font-semibold">Bookary</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="rounded-full p-2 text-sidebar-foreground hover:bg-muted"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {items.map(({ to, label, icon: NavIcon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-active font-semibold text-sidebar-active-foreground"
                    : "text-sidebar-foreground hover:bg-muted"
                }`
              }
            >
              <NavIcon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm text-sidebar-foreground hover:bg-muted"
          >
            <SignOut size={19} aria-hidden="true" />
            Đăng xuất
          </button>
          <NavLink
            to={accountPath}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-xl border p-2 transition-colors hover:bg-muted ${
                isActive ? "border-accent bg-muted" : "border-border"
              }`
            }
          >
            <Avatar name={meName ?? "?"} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{meName}</p>
              <p className="truncate font-mono text-xs text-sidebar-muted-foreground">{meCode}</p>
            </div>
          </NavLink>
        </div>
      </div>
    </div>
  );
}
