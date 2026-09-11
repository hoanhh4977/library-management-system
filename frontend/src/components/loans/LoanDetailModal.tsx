import { X } from "@phosphor-icons/react";

import { useLoan } from "../../hooks/useLoans";
import { StatusBadge, loanDetailStatus } from "../StatusBadge";
import { BookCover } from "../books/BookCover";
import { Skeleton } from "../Skeleton";
import type { LoanRequestStatus } from "../../types/loanRequest";

export interface LoanRenewalContext {
  extensionDays: number;
  status: LoanRequestStatus;
}

/** today/due_date are plain YYYY-MM-DD strings, which sort/compare lexicographically —
 * mirrors the `max(loan.due_date, date.today())` base the backend extends from
 * (src/services/loan_service.py renew_loan), so the preview matches what approving
 * a still-pending request will actually produce. */
function expectedRenewalDate(dueDate: string, extensionDays: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const base = dueDate > today ? dueDate : today;
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + extensionDays);
  return d.toISOString().slice(0, 10);
}

/** "Xem chi tiết phiếu mượn" popup — opened from any loan_code/loan reference
 * anywhere in the app (request cards, activity rows, loan tables, ...) so staff and
 * readers don't need to hunt down the full record through a different page.
 *
 * `renewal` is passed when the reference clicked was specifically a "yêu cầu gia hạn"
 * — the loan record alone only ever exposes the *current* due_date and a `renewed`
 * flag, so without this context there's no way to show what that particular request
 * extends to (or extended to, if already approved). */
export function LoanDetailModal({
  loanId,
  renewal,
  onClose,
}: {
  loanId: string;
  renewal?: LoanRenewalContext;
  onClose: () => void;
}) {
  const { data: loan, isLoading, isError } = useLoan(loanId);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết phiếu mượn"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-heading text-sm font-semibold">Chi tiết phiếu mượn</p>
            {loan && <p className="font-mono text-xs text-muted-foreground">{loan.code}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        )}

        {isError && <p className="text-sm text-danger-foreground">Không tải được chi tiết phiếu mượn.</p>}

        {loan && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground">Ngày mượn</dt>
                <dd className="font-mono font-medium">{loan.loan_date}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground">Hẹn trả</dt>
                <dd className="font-mono font-medium">{loan.due_date}</dd>
              </div>
              {loan.renewed && (
                <span className="rounded-full bg-info px-2 py-0.5 text-xs font-medium text-info-foreground">
                  Đã gia hạn
                </span>
              )}
            </div>

            {renewal && (
              <div className="mb-4 rounded-xl border border-info bg-info/10 px-3 py-2 text-sm">
                <p className="font-medium text-info-foreground">
                  Yêu cầu gia hạn +{renewal.extensionDays} ngày
                </p>
                {renewal.status === "approved" && (
                  <p className="text-muted-foreground">
                    Đã gia hạn đến <span className="font-mono font-medium text-foreground">{loan.due_date}</span>
                  </p>
                )}
                {renewal.status === "pending" && (
                  <p className="text-muted-foreground">
                    Dự kiến gia hạn đến{" "}
                    <span className="font-mono font-medium text-foreground">
                      {expectedRenewalDate(loan.due_date, renewal.extensionDays)}
                    </span>{" "}
                    nếu được duyệt
                  </p>
                )}
                {renewal.status === "rejected" && (
                  <p className="text-muted-foreground">Yêu cầu đã bị từ chối — hẹn trả giữ nguyên.</p>
                )}
              </div>
            )}

            <ul className="flex flex-col gap-2.5">
              {loan.details.map((detail) => (
                <li
                  key={detail.book_id}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2"
                >
                  <div className="h-12 w-8 flex-none overflow-hidden rounded">
                    <BookCover src={detail.book_cover_image_url} title={detail.book_title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{detail.book_title}</p>
                    <p className="text-xs text-muted-foreground">
                      Số lượng {detail.quantity}
                      {detail.actual_return_date && ` · Đã trả ${detail.actual_return_date}`}
                    </p>
                  </div>
                  <StatusBadge status={loanDetailStatus(detail.status, loan.due_date)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
