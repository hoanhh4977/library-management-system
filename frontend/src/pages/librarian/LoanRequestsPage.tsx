import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowsClockwise, BookOpen, CalendarBlank, CheckCircle, Clock, User, XCircle } from "@phosphor-icons/react";

import {
  useAllLoanRequests,
  useApproveLoanRequest,
  usePendingLoanRequests,
  useRejectLoanRequest,
} from "../../hooks/useLoanRequests";
import { ApiError } from "../../services/apiClient";
import { BookCover } from "../../components/books/BookCover";
import { LoanDetailModal, type LoanRenewalContext } from "../../components/loans/LoanDetailModal";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { StatusBadge } from "../../components/StatusBadge";
import { formatShortDate, pendingCountSeries, weekOverWeekLevel } from "../../lib/trend";
import type { LoanRequest } from "../../types/loanRequest";

/** Request card, cover-forward — ref: "Book Request" card (thumbnail + requester + dates). */
function RequestCard({
  request,
  onViewLoan,
}: {
  request: LoanRequest;
  onViewLoan: (loanId: string, renewal?: LoanRenewalContext) => void;
}) {
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
    <li className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="h-16 w-12 flex-none overflow-hidden rounded-lg bg-muted">
          {request.kind === "borrow" ? (
            <BookCover src={firstItem?.book_cover_image_url ?? null} title={firstItem?.book_title ?? request.reader_name} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-info-foreground">
              <ArrowsClockwise size={20} aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {request.kind === "borrow" ? (
            <p className="truncate text-sm font-semibold">
              {request.items.map((i) => `${i.book_title} × ${i.quantity}`).join(", ")}
              {request.loan_period_days && (
                <span className="font-normal text-muted-foreground"> ({request.loan_period_days} ngày)</span>
              )}
            </p>
          ) : (
            <button
              type="button"
              onClick={() =>
                request.loan_id &&
                onViewLoan(request.loan_id, { extensionDays: request.extension_days ?? 7, status: request.status })
              }
              className="truncate text-sm font-semibold text-accent underline-offset-2 hover:underline"
            >
              Gia hạn phiếu {request.loan_code}
              {request.extension_days ? ` (+${request.extension_days} ngày)` : ""}
            </button>
          )}
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
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            {reject.isPending ? "Đang từ chối…" : "Từ chối"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleApprove}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {approve.isPending ? "Đang duyệt…" : "Phê duyệt"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger-foreground">{error}</p>}
    </li>
  );
}

export function LoanRequestsPage() {
  const { data: requests, isLoading } = usePendingLoanRequests();
  const { data: allRequests } = useAllLoanRequests();
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const [viewRenewal, setViewRenewal] = useState<LoanRenewalContext | undefined>(undefined);
  const handleViewLoan = (loanId: string, renewal?: LoanRenewalContext) => {
    setViewLoanId(loanId);
    setViewRenewal(renewal);
  };

  // Arriving from e.g. the admin dashboard's "Sách quá hạn trả" widget with
  // ?reader=<reader_id> scopes both lists to that reader on load — read once, the
  // filter inputs below own the value from then on.
  const [searchParams] = useSearchParams();
  const initialReaderFilter = searchParams.get("reader") ?? "";
  const [pendingSearch, setPendingSearch] = useState(initialReaderFilter);
  const [pendingKind, setPendingKind] = useState<"" | "borrow" | "renew">("");
  const [historySearch, setHistorySearch] = useState(initialReaderFilter);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  usePageHeader({ title: "Yêu cầu từ độc giả", subtitle: "Duyệt yêu cầu mượn và gia hạn sách" });

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const items = allRequests ?? [];
    const approvedToday = items.filter(
      (r) => r.status === "approved" && r.reviewed_at?.slice(0, 10) === todayStr,
    ).length;
    const rejectedToday = items.filter(
      (r) => r.status === "rejected" && r.reviewed_at?.slice(0, 10) === todayStr,
    ).length;
    const pendingRenew = items.filter((r) => r.status === "pending" && r.kind === "renew").length;
    return { approvedToday, rejectedToday, pendingRenew };
  }, [allRequests, todayStr]);

  // "Đang chờ duyệt" is a backlog SIZE, not a daily arrival count — track the same
  // backlog over time (weekOverWeekLevel), not the volume of new requests per day.
  const pendingSparkline = useMemo(
    () => (allRequests ? pendingCountSeries(allRequests, 14) : undefined),
    [allRequests],
  );
  const pendingTrend = useMemo(
    () => (pendingSparkline ? weekOverWeekLevel(pendingSparkline) : undefined),
    [pendingSparkline],
  );

  const filteredPending = useMemo(() => {
    const query = pendingSearch.trim().toLowerCase();
    return (requests ?? []).filter((r) => {
      const matchesQuery =
        !query ||
        r.reader_name.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query) ||
        r.reader_id.toLowerCase().includes(query) ||
        (r.loan_code ?? "").toLowerCase().includes(query);
      const matchesKind = !pendingKind || r.kind === pendingKind;
      return matchesQuery && matchesKind;
    });
  }, [requests, pendingSearch, pendingKind]);

  const hasPendingFilters = pendingSearch || pendingKind;

  const history = useMemo(
    () =>
      (allRequests ?? [])
        .filter((r) => r.status !== "pending")
        .sort((a, b) => (b.reviewed_at ?? b.requested_at).localeCompare(a.reviewed_at ?? a.requested_at)),
    [allRequests],
  );

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return history.filter((r) => {
      const matchesQuery =
        !query ||
        r.reader_name.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query) ||
        r.reader_id.toLowerCase().includes(query) ||
        (r.loan_code ?? "").toLowerCase().includes(query);
      const requestedDate = r.requested_at.slice(0, 10);
      const matchesFrom = !historyFrom || requestedDate >= historyFrom;
      const matchesTo = !historyTo || requestedDate <= historyTo;
      return matchesQuery && matchesFrom && matchesTo;
    });
  }, [history, historySearch, historyFrom, historyTo]);

  const hasHistoryFilters = historySearch || historyFrom || historyTo;

  return (
    <div className="animate-fade-in">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Đang chờ duyệt"
          value={requests?.length ?? 0}
          icon={Clock}
          tone="pending"
          sparkline={pendingSparkline}
          trend={pendingTrend}
        />
        <StatTile label="Đã duyệt hôm nay" value={stats.approvedToday} icon={CheckCircle} tone="success" />
        <StatTile label="Đã từ chối hôm nay" value={stats.rejectedToday} icon={XCircle} tone="warning" />
        <StatTile label="Gia hạn đang chờ" value={stats.pendingRenew} icon={ArrowsClockwise} tone="info" />
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="font-heading text-sm font-semibold">Đang chờ duyệt</p>
            <input
              type="search"
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              placeholder="Tìm theo tên, mã yêu cầu, mã độc giả, mã phiếu…"
              className="min-w-[160px] flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <select
              value={pendingKind}
              onChange={(e) => setPendingKind(e.target.value as typeof pendingKind)}
              aria-label="Lọc theo loại yêu cầu"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">Mượn & gia hạn</option>
              <option value="borrow">Chỉ yêu cầu mượn</option>
              <option value="renew">Chỉ yêu cầu gia hạn</option>
            </select>
            {hasPendingFilters && (
              <button
                type="button"
                onClick={() => {
                  setPendingSearch("");
                  setPendingKind("");
                }}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                <XCircle size={13} aria-hidden="true" /> Xoá lọc
              </button>
            )}
          </div>
          {isLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          )}
          {!isLoading && (requests?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <CheckCircle size={28} className="text-success-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
            </div>
          )}
          {!isLoading && (requests?.length ?? 0) > 0 && filteredPending.length === 0 && hasPendingFilters && (
            <p className="py-6 text-center text-sm text-muted-foreground">Không tìm thấy yêu cầu phù hợp.</p>
          )}
          <ul className="flex max-h-[640px] flex-col gap-2 overflow-y-auto">
            {filteredPending.map((request) => (
              <RequestCard key={request.id} request={request} onViewLoan={handleViewLoan} />
            ))}
          </ul>
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20">
          <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border p-4">
            <p className="font-heading text-sm font-semibold">Lịch sử gần đây</p>
            <input
              type="search"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Tìm theo tên, mã yêu cầu, mã độc giả, mã phiếu…"
              className="min-w-[160px] flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Từ
              <input
                type="date"
                value={historyFrom}
                onChange={(e) => setHistoryFrom(e.target.value)}
                className="rounded-full border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Đến
              <input
                type="date"
                value={historyTo}
                onChange={(e) => setHistoryTo(e.target.value)}
                className="rounded-full border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
              />
            </label>
            {hasHistoryFilters && (
              <button
                type="button"
                onClick={() => {
                  setHistorySearch("");
                  setHistoryFrom("");
                  setHistoryTo("");
                }}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                <XCircle size={13} aria-hidden="true" /> Xoá lọc
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {filteredHistory.length.toLocaleString("vi-VN")} kết quả
            </span>
          </div>
          {filteredHistory.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {hasHistoryFilters ? "Không tìm thấy yêu cầu phù hợp." : "Chưa có yêu cầu nào được xử lý."}
            </p>
          ) : (
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Độc giả</th>
                    <th className="px-4 py-3">Nội dung</th>
                    <th className="px-4 py-3">Ngày xử lý</th>
                    <th className="px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((req) => (
                    <tr key={req.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{req.reader_name}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {req.loan_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleViewLoan(
                                req.loan_id!,
                                req.kind === "renew"
                                  ? { extensionDays: req.extension_days ?? 7, status: req.status }
                                  : undefined,
                              )
                            }
                            className="flex items-center gap-1.5 text-accent underline-offset-2 hover:underline"
                          >
                            {req.kind === "borrow" ? (
                              <BookOpen size={14} aria-hidden="true" />
                            ) : (
                              <ArrowsClockwise size={14} aria-hidden="true" />
                            )}
                            {req.kind === "borrow"
                              ? req.items.map((i) => i.book_title).join(", ") || "Mượn sách"
                              : `Gia hạn ${req.loan_code}`}
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <BookOpen size={14} aria-hidden="true" />
                            {req.items.map((i) => i.book_title).join(", ") || "Mượn sách"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {req.reviewed_at ? formatShortDate(req.reviewed_at.slice(0, 10)) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={req.status === "approved" ? "approved" : "rejected"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {viewLoanId && (
        <LoanDetailModal loanId={viewLoanId} renewal={viewRenewal} onClose={() => setViewLoanId(null)} />
      )}
    </div>
  );
}
