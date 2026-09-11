import { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  BookOpen,
  CalendarBlank,
  ClipboardText,
  Clock,
  PaperPlaneTilt,
  Warning,
} from "@phosphor-icons/react";

import { StatusBadge, loanDetailStatus } from "../../components/StatusBadge";
import { BookCover } from "../../components/books/BookCover";
import { LoanDetailModal, type LoanRenewalContext } from "../../components/loans/LoanDetailModal";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { useMe } from "../../hooks/useMe";
import { useReaderLoans } from "../../hooks/useLoans";
import { useCreateRenewRequest, useMyLoanRequests } from "../../hooks/useLoanRequests";
import type { Loan } from "../../types/loan";
import type { LoanRequest } from "../../types/loanRequest";

const RENEWAL_DAY_OPTIONS = [1, 3, 5, 7] as const;

function daysLeftLabel(dueDate: string): string {
  const days = Math.round((new Date(dueDate).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  if (days < 0) return `Quá hạn ${-days} ngày`;
  if (days === 0) return "Hẹn trả hôm nay";
  return `Còn ${days} ngày`;
}

function RenewAction({ loanId }: { loanId: string }) {
  const [days, setDays] = useState<number>(7);
  const createRenewRequest = useCreateRenewRequest();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        aria-label="Số ngày gia hạn"
        className="rounded-full border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        {RENEWAL_DAY_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} ngày
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={createRenewRequest.isPending}
        onClick={() => createRenewRequest.mutate({ loanId, extensionDays: days })}
        className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {createRenewRequest.isPending ? "Đang gửi…" : "Yêu cầu gia hạn"}
      </button>
    </div>
  );
}

function LoanCard({
  loan,
  pendingRenew,
  onViewLoan,
}: {
  loan: Loan;
  pendingRenew: boolean;
  onViewLoan: (loanId: string) => void;
}) {
  const hasActiveBorrowing = loan.details.some((d) => d.status === "borrowing");
  const overdue = hasActiveBorrowing && new Date(loan.due_date) < new Date(new Date().toDateString());

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onViewLoan(loan.id)}
          className="font-mono text-xs text-accent underline-offset-2 hover:underline"
        >
          {loan.code}
        </button>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarBlank size={13} aria-hidden="true" />
            {loan.loan_date} → {loan.due_date}
          </span>
          {hasActiveBorrowing && (
            <span className={overdue ? "font-semibold text-warning-foreground" : ""}>
              {daysLeftLabel(loan.due_date)}
            </span>
          )}
        </div>
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
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3 text-sm">
          {pendingRenew ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock size={14} aria-hidden="true" /> Đã gửi yêu cầu gia hạn — chờ duyệt
            </span>
          ) : loan.renewed ? (
            <span className="text-muted-foreground">Đã gia hạn 1 lần</span>
          ) : (
            <RenewAction loanId={loan.id} />
          )}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  request,
  onViewLoan,
}: {
  request: LoanRequest;
  onViewLoan: (loanId: string, renewal?: LoanRenewalContext) => void;
}) {
  const firstItem = request.items[0];
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
      {request.kind === "borrow" && (
        <div className="h-12 w-8 flex-none overflow-hidden rounded">
          <BookCover src={firstItem?.book_cover_image_url ?? null} title={firstItem?.book_title ?? ""} />
        </div>
      )}
      {request.loan_id ? (
        <button
          type="button"
          onClick={() =>
            onViewLoan(
              request.loan_id!,
              request.kind === "renew"
                ? { extensionDays: request.extension_days ?? 7, status: request.status }
                : undefined,
            )
          }
          className="min-w-0 flex-1 truncate text-left text-sm text-accent underline-offset-2 hover:underline"
        >
          {request.kind === "borrow"
            ? `Mượn: ${request.items.map((i) => i.book_title).join(", ")}${request.loan_period_days ? ` (${request.loan_period_days} ngày)` : ""}`
            : `Gia hạn phiếu ${request.loan_code}${request.extension_days ? ` (+${request.extension_days} ngày)` : ""}`}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm">
          {request.kind === "borrow"
            ? `Mượn: ${request.items.map((i) => i.book_title).join(", ")}${request.loan_period_days ? ` (${request.loan_period_days} ngày)` : ""}`
            : "Gia hạn"}
        </span>
      )}
      <StatusBadge status={request.status} />
    </li>
  );
}

/** Read-only history (FR-022/FR-027) plus the two self-service actions we do allow:
 * requesting a renewal, and tracking the status of requests already sent (FR: reader
 * self-service borrow/renew — Librarian still approves/rejects everything). */
export function HistoryPage() {
  const { data: me } = useMe();
  const { data: loans, isLoading } = useReaderLoans(me?.id);
  const { data: myRequests } = useMyLoanRequests();
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const [viewRenewal, setViewRenewal] = useState<LoanRenewalContext | undefined>(undefined);
  const handleViewLoan = (loanId: string, renewal?: LoanRenewalContext) => {
    setViewLoanId(loanId);
    setViewRenewal(renewal);
  };

  usePageHeader({ title: "Lịch sử mượn của tôi", subtitle: "Theo dõi phiếu mượn và yêu cầu gia hạn" });

  const cardLocked = me?.library_card?.status === "locked";

  const pendingRenewLoanIds = useMemo(
    () =>
      new Set((myRequests ?? []).filter((r) => r.kind === "renew" && r.status === "pending").map((r) => r.loan_id)),
    [myRequests],
  );

  const borrowRequests = useMemo(() => (myRequests ?? []).filter((r) => r.kind === "borrow"), [myRequests]);
  const renewRequests = useMemo(() => (myRequests ?? []).filter((r) => r.kind === "renew"), [myRequests]);

  const stats = useMemo(() => {
    const allDetails = (loans ?? []).flatMap((l) => l.details.map((d) => ({ ...d, dueDate: l.due_date })));
    const borrowing = allDetails.filter((d) => d.status === "borrowing").length;
    const today = new Date(new Date().toDateString());
    const overdue = allDetails.filter((d) => d.status === "borrowing" && new Date(d.dueDate) < today).length;
    const pendingRequests = (myRequests ?? []).filter((r) => r.status === "pending").length;
    return { borrowing, overdue, pendingRequests, totalLoans: loans?.length ?? 0 };
  }, [loans, myRequests]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Đang mượn" value={stats.borrowing} icon={BookOpen} tone="info" />
        <StatTile label="Quá hạn" value={stats.overdue} icon={Warning} tone="warning" />
        <StatTile label="Yêu cầu đang chờ" value={stats.pendingRequests} icon={Clock} tone="pending" />
        <StatTile label="Tổng phiếu mượn" value={stats.totalLoans} icon={ClipboardText} tone="success" />
      </div>

      {cardLocked && (
        <p className="rounded-xl bg-danger px-4 py-2.5 text-sm text-danger-foreground">
          Thẻ thư viện của bạn đang bị khóa — vui lòng trả sách quá hạn hoặc hoàn tất đền bù để tiếp tục mượn sách.
        </p>
      )}

      <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info text-info-foreground">
              <BookOpen size={16} aria-hidden="true" />
            </span>
            <p className="font-heading text-sm font-semibold">Phiếu mượn của bạn</p>
          </div>
          <span className="text-xs text-muted-foreground">{loans?.length ?? 0} phiếu</span>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        )}
        {!isLoading && (loans?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <BookOpen size={28} className="text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Bạn chưa mượn sách nào.</p>
          </div>
        )}
        {!isLoading && (loans?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-3">
            {loans!.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                pendingRenew={pendingRenewLoanIds.has(loan.id)}
                onViewLoan={handleViewLoan}
              />
            ))}
          </div>
        )}
      </div>

      {(borrowRequests.length > 0 || renewRequests.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {borrowRequests.length > 0 && (
            <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <PaperPlaneTilt size={16} aria-hidden="true" />
                </span>
                <p className="font-heading text-sm font-semibold">Yêu cầu mượn đã gửi</p>
              </div>
              <ul className="flex flex-col gap-2">
                {borrowRequests.map((r) => (
                  <RequestRow key={r.id} request={r} onViewLoan={handleViewLoan} />
                ))}
              </ul>
            </div>
          )}

          {renewRequests.length > 0 && (
            <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info text-info-foreground">
                  <ArrowsClockwise size={16} aria-hidden="true" />
                </span>
                <p className="font-heading text-sm font-semibold">Yêu cầu gia hạn đã gửi</p>
              </div>
              <ul className="flex flex-col gap-2">
                {renewRequests.map((r) => (
                  <RequestRow key={r.id} request={r} onViewLoan={handleViewLoan} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {viewLoanId && (
        <LoanDetailModal loanId={viewLoanId} renewal={viewRenewal} onClose={() => setViewLoanId(null)} />
      )}
    </div>
  );
}
