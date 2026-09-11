import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleNotch, DotsThree } from "@phosphor-icons/react";

import { useConfirmCompensation, useRenewLoan, useReportLost, useReturnItem } from "../../hooks/useLoans";
import { StatusBadge, loanDetailStatus } from "../StatusBadge";
import { BookCover } from "../books/BookCover";
import { LoanDetailModal } from "./LoanDetailModal";
import type { Loan } from "../../types/loan";

const RENEWAL_DAY_OPTIONS = [1, 3, 5, 7] as const;

/** Portals the dropdown to document.body, positioned from the trigger's own
 * bounding rect — the table this sits in scrolls (overflow-x-auto, which browsers
 * also clip on the Y axis for), so a normal absolutely-positioned child got cut off
 * whenever the menu grew taller than the table's visible area (e.g. once the Gia hạn
 * day-options were added). Recomputes on scroll/resize so it never drifts. */
function usePortalMenuPosition(open: boolean, triggerRef: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right - window.scrollX });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);

  return pos;
}

function RowActions({
  loan,
  bookId,
  status,
  renew,
}: {
  loan: Loan;
  bookId: string;
  status: string;
  renew: ReturnType<typeof useRenewLoan>;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePortalMenuPosition(open, triggerRef);
  const returnItem = useReturnItem();
  const reportLost = useReportLost();
  const confirmCompensation = useConfirmCompensation();

  const busy =
    returnItem.isPending || renew.isPending || reportLost.isPending || confirmCompensation.isPending;

  useEffect(() => {
    if (!open) return;
    // The menu itself is portaled to document.body (outside triggerRef's subtree),
    // so a click on a menu item must also be excluded here — otherwise this fires on
    // mousedown, closes the menu (unmounting the portal) before the button's own
    // onClick ever runs, and every menu action silently does nothing.
    const closeOnOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  if (status === "returned" || status === "compensated") return null;

  return (
    <div className="inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Hành động khác"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        {busy ? (
          <CircleNotch size={18} weight="bold" className="animate-spin" aria-label="Đang xử lý" />
        ) : (
          <DotsThree size={18} weight="bold" />
        )}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "absolute", top: pos.top, right: pos.right }}
            className="z-30 w-40 rounded-md border border-border bg-card py-1 text-sm shadow-lg"
          >
            {status === "borrowing" && (
              <>
                <button
                  className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setOpen(false);
                    returnItem.mutate({ loanId: loan.id, bookId });
                  }}
                >
                  Trả sách
                </button>
                {!loan.renewed && (
                  <>
                    <p className="px-3 pt-1.5 text-xs uppercase tracking-wide text-muted-foreground">Gia hạn</p>
                    <div className="flex flex-wrap gap-1 px-3 pb-1.5 pt-1">
                      {RENEWAL_DAY_OPTIONS.map((n) => (
                        <button
                          key={n}
                          className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
                          onClick={() => {
                            setOpen(false);
                            renew.mutate({ loanId: loan.id, extensionDays: n });
                          }}
                        >
                          {n} ngày
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button
                  className="block w-full px-3 py-1.5 text-left text-danger-foreground hover:bg-muted"
                  onClick={() => {
                    setOpen(false);
                    reportLost.mutate({ loanId: loan.id, bookId });
                  }}
                >
                  Báo mất
                </button>
              </>
            )}
            {status === "pending_compensation" && (
              <button
                className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  confirmCompensation.mutate({ loanId: loan.id, bookId });
                }}
              >
                Xác nhận đền bù
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function LoanDetailsTable({ loans }: { loans: Loan[] }) {
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const renew = useRenewLoan();
  const rows = loans.flatMap((loan) => loan.details.map((detail) => ({ loan, detail })));

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Độc giả chưa có phiếu mượn nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2">Sách</th>
            <th className="py-2">Hẹn trả</th>
            <th className="py-2">Trạng thái</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ loan, detail }) => {
            const status = loanDetailStatus(detail.status, loan.due_date);
            const renewingThisLoan = renew.isPending && renew.variables?.loanId === loan.id;
            return (
              <tr key={`${loan.id}-${detail.book_id}`} className="border-b border-border">
                <td className="py-2">
                  <div className="flex items-center gap-2.5">
                    <BookCover src={detail.book_cover_image_url} title={detail.book_title} size="sm" />
                    <div>
                      {detail.book_title}
                      <button
                        type="button"
                        onClick={() => setViewLoanId(loan.id)}
                        className="block font-mono text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {loan.code}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="py-2 font-mono">{loan.due_date}</td>
                <td className="py-2">
                  {renewingThisLoan ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-current bg-card px-2.5 py-1 text-sm font-medium text-muted-foreground">
                      <CircleNotch size={14} weight="bold" className="animate-spin" aria-hidden="true" />
                      Đang gia hạn…
                    </span>
                  ) : (
                    <StatusBadge status={status} />
                  )}
                </td>
                <td className="py-2 text-right">
                  <RowActions loan={loan} bookId={detail.book_id} status={detail.status} renew={renew} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {viewLoanId && <LoanDetailModal loanId={viewLoanId} onClose={() => setViewLoanId(null)} />}
    </div>
  );
}
