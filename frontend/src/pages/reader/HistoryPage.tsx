import { StatusBadge, loanDetailStatus } from "../../components/StatusBadge";
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

  const pendingRenewLoanIds = new Set(
    (myRequests ?? []).filter((r) => r.kind === "renew" && r.status === "pending").map((r) => r.loan_id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-4 font-heading text-xl font-semibold">Lịch sử mượn của tôi</h1>

        {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
        {!isLoading && loans?.length === 0 && (
          <p className="text-sm text-muted-foreground">Bạn chưa mượn sách nào.</p>
        )}

        <div className="flex flex-col gap-3">
          {loans?.map((loan) => {
            const hasActiveBorrowing = loan.details.some((d) => d.status === "borrowing");
            const renewDisabled = loan.renewed || pendingRenewLoanIds.has(loan.id) || !hasActiveBorrowing;
            return (
              <div key={loan.id} className="rounded-md border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between font-mono text-xs text-muted-foreground">
                  <span>{loan.code}</span>
                  <span>
                    Mượn {loan.loan_date} · Hẹn trả {loan.due_date}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {loan.details.map((detail) => (
                    <li key={detail.book_id} className="flex items-center justify-between text-sm">
                      <span>{detail.book_title}</span>
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
                        className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
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
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Yêu cầu đã gửi</p>
          <ul className="flex flex-col gap-2">
            {myRequests.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span>
                  {r.kind === "borrow"
                    ? `Mượn: ${r.items.map((i) => i.book_title).join(", ")}`
                    : `Gia hạn phiếu ${r.loan_code}`}
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
