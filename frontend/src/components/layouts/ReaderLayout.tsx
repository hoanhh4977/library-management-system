import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, ClipboardText, SignOut } from "@phosphor-icons/react";

import { useLogout } from "../../hooks/useLogout";
import { useMe } from "../../hooks/useMe";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
  }`;

/** Reader shell: two tabs only, no sidebar — per MASTER.md "Điều hướng theo vai trò". */
export function ReaderLayout() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <nav className="flex gap-2">
          <NavLink to="/reader/search" className={tabClass}>
            <BookOpen size={18} aria-hidden="true" />
            Tra cứu sách
          </NavLink>
          <NavLink to="/reader/history" className={tabClass}>
            <ClipboardText size={18} aria-hidden="true" />
            Lịch sử mượn của tôi
          </NavLink>
        </nav>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{me?.full_name}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"
            aria-label="Đăng xuất"
          >
            <SignOut size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
