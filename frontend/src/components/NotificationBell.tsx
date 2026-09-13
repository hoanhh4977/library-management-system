import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, IdentificationCard, Tray } from "@phosphor-icons/react";

import { usePendingLoanRequests } from "../hooks/useLoanRequests";
import { usePendingUnlockRequests } from "../hooks/useCards";

/** Bell icon in the shared topbar — surfaces the same pending loan/unlock-request
 * counts already shown elsewhere in the app (dashboard tile, sidebar badge target),
 * not a separate notifications feed we don't have data for. Loan-request review is
 * Librarian-only and card-unlock review is Admin-only (see loan_requests.py /
 * cards.py) — each `enabled` gates its query so the other role never fires a 403. */
export function NotificationBell({ role }: { role: "admin" | "librarian" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: loanRequests } = usePendingLoanRequests(role === "librarian");
  const { data: unlockRequests } = usePendingUnlockRequests(role === "admin");

  const loanCount = role === "librarian" ? (loanRequests?.length ?? 0) : 0;
  const unlockCount = role === "admin" ? (unlockRequests?.length ?? 0) : 0;
  const total = loanCount + unlockCount;

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const requestsPath = role === "admin" ? "/admin/unlock-requests" : "/librarian/requests";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `Thông báo — ${total} yêu cầu đang chờ` : "Thông báo"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell size={17} aria-hidden="true" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-foreground px-1 text-[10px] font-semibold text-white"
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
          {total === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">Không có yêu cầu nào đang chờ.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {loanCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate("/librarian/requests");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-pending text-pending-foreground">
                      <Tray size={15} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="font-medium">{loanCount} yêu cầu mượn/gia hạn</span>
                      <span className="block text-xs text-muted-foreground">đang chờ duyệt</span>
                    </span>
                  </button>
                </li>
              )}
              {unlockCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(requestsPath);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-pending text-pending-foreground">
                      <IdentificationCard size={15} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="font-medium">{unlockCount} yêu cầu mở khóa thẻ</span>
                      <span className="block text-xs text-muted-foreground">đang chờ duyệt</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
