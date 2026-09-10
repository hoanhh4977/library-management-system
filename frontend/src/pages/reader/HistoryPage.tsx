import { CalendarBlank } from "@phosphor-icons/react";

import { StatusBadge, loanDetailStatus } from "../../components/StatusBadge";
import { BookCover } from "../../components/books/BookCover";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { useMe } from "../../hooks/useMe";
import { useReaderLoans } from "../../hooks/useLoans";
import { useCreateRenewRequest, useMyLoanRequests } from "../../hooks/useLoanRequests";

/** Read-only history (FR-022/FR-027) plus the two self-service actions we do allow:
 * requesting a renewal, and tracking the status of requests already sent (FR: reader
 * self-service borrow/renew — Librarian still approves/rejects everything). */
export function HistoryPage() {
  const { data: me } = useMe();
  const { data: loans, isLoading } = useReaderLoans(me?.id);
  const { data: myRequests } = useMyLoanRequests();
  const createRenewRequest = useCreateRenewRequest();

  usePageHeader({ title: "Lịch sử mượn của tôi", subtitle: "Theo dõi phiếu mượn và yêu cầu gia hạn" });

  const pendingRenewLoanIds = new Set(
    (myRequests ?? []).filter((r) => r.kind === "renew" && r.status === "pending").map((r) => r.loan_id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {!isLoading && loans?.length === 0 && (
          <p className="text-sm text-muted-foreground">Bạn chưa mượn sách nào.</p>
        )}

        <div className="flex flex-col gap-3">
          {loans?.map((loan) => {
            const hasActiveBorrowing = loan.details.some((d) => d.status === "borrowing");
            const renewDisabled = loan.renewed || pendingRenewLoanIds.has(loan.id) || !hasActiveBorrowing;
            return (
              <div key={loan.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{loan.code}</span>
                  <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    <CalendarBlank size={13} aria-hidden="true" />
                    {loan.loan_date} → {loan.due_date}
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {loan.details.map((detail) => (
                    <li key={detail.book_id} className="flex items-center gap-3">
                      <div className="h-14 w-10 flex-none overflow-hidden rounded-md">
                        <BookCover src={detail.book_cover_image_url} title={detail.book_title} />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{detail.book_title}</span>
                      <StatusBadge status={loanDetailStatus(detail.status, loan.due_date)} />
                    </li>
                  ))}
                </ul>
                {hasActiveBorrowing && (
                  <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                    {pendingRenewLoanIds.has(loan.id) ? (
                      <span className="text-muted-foreground">Đã gửi yêu cầu gia hạn — chờ duyệt</span>
                    ) : loan.renewed ? (
                      <span className="text-muted-foreground">Đã gia hạn 1 lần</span>
                    ) : (
                      <button
                        type="button"
                        disabled={renewDisabled || createRenewRequest.isPending}
                        onClick={() => createRenewRequest.mutate(loan.id)}
                        className="rounded-full border border-border px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-50"
                      >
                        Yêu cầu gia hạn
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {myRequests && myRequests.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 font-heading text-sm font-semibold">Yêu cầu đã gửi</p>
          <ul className="flex flex-col gap-2">
            {myRequests.map((r) => {
              const firstItem = r.items[0];
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  {r.kind === "borrow" && (
                    <div className="h-12 w-8 flex-none overflow-hidden rounded">
                      <BookCover src={firstItem?.book_cover_image_url ?? null} title={firstItem?.book_title ?? ""} />
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.kind === "borrow"
                      ? `Mượn: ${r.items.map((i) => i.book_title).join(", ")}`
                      : `Gia hạn phiếu ${r.loan_code}`}
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
