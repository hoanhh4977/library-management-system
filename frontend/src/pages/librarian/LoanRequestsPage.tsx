import { useState } from "react";
import { CalendarBlank, User } from "@phosphor-icons/react";

import { useApproveLoanRequest, usePendingLoanRequests, useRejectLoanRequest } from "../../hooks/useLoanRequests";
import { ApiError } from "../../services/apiClient";
import { BookCover } from "../../components/books/BookCover";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import type { LoanRequest } from "../../types/loanRequest";

/** Request card, cover-forward — ref: "Book Request" card (thumbnail + requester + dates). */
function RequestCard({ request }: { request: LoanRequest }) {
  const approve = useApproveLoanRequest();
  const reject = useRejectLoanRequest();
  const [error, setError] = useState<string | null>(null);
  const busy = approve.isPending || reject.isPending;

  async function handleApprove() {
    setError(null);
    try {
      await approve.mutateAsync(request.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thể phê duyệt");
    }
  }

  const firstItem = request.items[0];

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="h-16 w-12 flex-none overflow-hidden rounded-lg bg-muted">
          <BookCover
            src={firstItem?.book_cover_image_url ?? null}
            title={firstItem?.book_title ?? request.reader_name}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {request.kind === "borrow"
              ? request.items.map((i) => `${i.book_title} × ${i.quantity}`).join(", ")
              : `Gia hạn phiếu ${request.loan_code}`}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User size={13} aria-hidden="true" /> {request.reader_name}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <CalendarBlank size={13} aria-hidden="true" />
              {new Date(request.requested_at).toLocaleDateString("vi-VN")}
            </span>
          </div>
        </div>
        <div className="flex flex-none gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => reject.mutate(request.id)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Từ chối
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleApprove}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground"
          >
            Phê duyệt
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger-foreground">{error}</p>}
    </li>
  );
}

export function LoanRequestsPage() {
  const { data: requests, isLoading } = usePendingLoanRequests();

  usePageHeader({ title: "Yêu cầu từ độc giả", subtitle: "Duyệt yêu cầu mượn và gia hạn sách" });

  return (
    <div>
      {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
      {!isLoading && requests?.length === 0 && (
        <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
      )}

      <ul className="flex flex-col gap-3">
        {requests?.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </ul>
    </div>
  );
}
