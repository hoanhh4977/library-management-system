import { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  BookOpen,
  Check,
  CheckCircle,
  DownloadSimple,
  SignIn,
  Warning,
  X,
} from "@phosphor-icons/react";

import { useActivityLog } from "../../hooks/useReports";
import type { ActivityItem } from "../../hooks/useReports";
import {
  useAllLoanRequests,
  useApproveLoanRequest,
  usePendingLoanRequests,
  useRejectLoanRequest,
} from "../../hooks/useLoanRequests";
import { ApiError } from "../../services/apiClient";
import { Avatar } from "../../components/Avatar";
import { BookCover } from "../../components/books/BookCover";
import { LoanDetailModal, type LoanRenewalContext } from "../../components/loans/LoanDetailModal";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { StatusBadge, loanDetailStatus } from "../../components/StatusBadge";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import {
  bucketWeightedByDay,
  formatShortDate,
  pendingCountSeries,
  weekOverWeek,
  weekOverWeekLevel,
} from "../../lib/trend";
import type { LoanRequest } from "../../types/loanRequest";

/** Reconstructs, for each of the last `days` days, how many loan lines were overdue
 * ON that day — purely from `due_date` + `actual_return_date`, which don't change
 * after the fact, so this is exact history, not an approximation. */
function overdueCountSeries(items: ActivityItem[], days: number): number[] {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(todayMidnight);
    day.setDate(day.getDate() - i);
    const count = items.filter((item) => {
      const due = new Date(item.due_date);
      due.setHours(0, 0, 0, 0);
      if (due >= day) return false;
      if (!item.actual_return_date) return true;
      const returned = new Date(item.actual_return_date);
      returned.setHours(0, 0, 0, 0);
      return returned > day;
    }).length;
    series.push(count);
  }
  return series;
}

const TABS = [
  { key: "borrowing", label: "Đang mượn" },
  { key: "returned", label: "Đã trả" },
  { key: "overdue", label: "Quá hạn" },
  { key: "renewed", label: "Đã gia hạn" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function daysLeftLabel(item: ActivityItem): string {
  if (item.status === "returned") return "—";
  const days = Math.round((new Date(item.due_date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Quá hạn ${-days} ngày`;
  if (days === 0) return "Hôm nay";
  return `Còn ${days} ngày`;
}

// Mirrors StatusBadge's STATUS_MAP labels so the CSV reads the same as the on-screen
// table, including deriving "Quá hạn" for a still-borrowing line past its due date.
const STATUS_LABEL_VI: Record<string, string> = {
  borrowing: "Đang mượn",
  "borrowing-overdue": "Quá hạn",
  returned: "Đã trả",
  pending_compensation: "Chờ đền bù",
  compensated: "Đã đền bù",
};

function downloadActivitiesCsv(items: ActivityItem[]) {
  const header = ["Mã phiếu", "Sách", "Độc giả", "Ngày mượn", "Hạn trả", "Ngày trả thực tế", "Trạng thái"];
  const rows = items.map((i) => [
    i.loan_code,
    i.book_title,
    i.reader_name,
    i.loan_date,
    i.due_date,
    i.actual_return_date ?? "",
    STATUS_LABEL_VI[loanDetailStatus(i.status, i.due_date)] ?? i.status,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hoat-dong-thu-vien.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/** Leaderboard of readers by total items borrowed (all-time, within the fetched log)
 * — real aggregation, no stock photos (Avatar renders an initial, not a fabricated
 * headshot like the mockup's stock avatars). */
function TopBorrowers({ items }: { items: ActivityItem[] }) {
  const ranked = useMemo(() => {
    const map = new Map<string, { name: string; code: string; count: number }>();
    for (const item of items) {
      const entry = map.get(item.reader_id) ?? { name: item.reader_name, code: item.reader_code, count: 0 };
      entry.count += item.quantity;
      map.set(item.reader_id, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [items]);

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {ranked.map((reader) => (
        <div
          key={reader.code}
          className="flex flex-none flex-col items-center gap-2 rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 px-4 py-3 text-center"
        >
          <Avatar name={reader.name} size="lg" />
          <div>
            <p className="text-sm font-medium">{reader.name}</p>
            <p className="font-mono text-xs text-muted-foreground">ID: {reader.code}</p>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen size={12} aria-hidden="true" /> {reader.count} sách đã mượn
          </p>
        </div>
      ))}
    </div>
  );
}

/** One pending request row with inline approve/reject — ref: mockup shows action
 * buttons directly on the "Yêu cầu từ độc giả" panel, not just a link elsewhere. */
function PendingRequestRow({
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

  async function handleReject() {
    setError(null);
    try {
      await reject.mutateAsync(request.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thể từ chối");
    }
  }

  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-border bg-background px-2.5 py-2 text-sm">
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-7 flex-none overflow-hidden rounded">
          <BookCover src={request.items[0]?.book_cover_image_url ?? null} title={request.reader_name} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{request.reader_name}</p>
          {request.kind === "borrow" ? (
            <p className="truncate text-xs text-muted-foreground">{request.items[0]?.book_title}</p>
          ) : (
            <button
              type="button"
              onClick={() =>
                request.loan_id &&
                onViewLoan(request.loan_id, { extensionDays: request.extension_days ?? 7, status: request.status })
              }
              className="truncate text-left text-xs text-accent underline-offset-2 hover:underline"
            >
              Gia hạn {request.loan_code}
            </button>
          )}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <button
            type="button"
            aria-label="Từ chối"
            disabled={busy}
            onClick={handleReject}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
          >
            <X size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Phê duyệt"
            disabled={busy}
            onClick={handleApprove}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <Check size={13} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-danger-foreground">{error}</p>}
    </li>
  );
}

export function LibraryActivitiesPage() {
  const { data: log, isLoading } = useActivityLog();
  const { data: pendingLoanRequests } = usePendingLoanRequests();
  const { data: allLoanRequests } = useAllLoanRequests();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("borrowing");
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const [viewRenewal, setViewRenewal] = useState<LoanRenewalContext | undefined>(undefined);
  const handleViewLoan = (loanId: string, renewal?: LoanRenewalContext) => {
    setViewLoanId(loanId);
    setViewRenewal(renewal);
  };

  usePageHeader({
    title: "Hoạt động thư viện",
    subtitle: "Theo dõi toàn bộ giao dịch mượn — trả sách",
    action: log && (
      <button
        type="button"
        onClick={() => downloadActivitiesCsv(log.items)}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        <DownloadSimple size={16} aria-hidden="true" /> Tải báo cáo hoạt động
      </button>
    ),
  });

  const items = useMemo(() => log?.items ?? [], [log]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = useMemo(
    () => ({
      checkoutsToday: items.filter((i) => i.loan_date === todayStr).reduce((s, i) => s + i.quantity, 0),
      returnsToday: items.filter((i) => i.actual_return_date === todayStr).reduce((s, i) => s + i.quantity, 0),
      renewRequests: pendingLoanRequests?.filter((r) => r.kind === "renew").length ?? 0,
      overdue: items.filter((i) => i.is_overdue).length,
    }),
    [items, todayStr, pendingLoanRequests],
  );

  // Real 14-day series for each tile's sparkline + week-over-week badge — flow
  // metrics (checkouts/returns/renew requests) compare summed weeks; the overdue
  // count is a level/snapshot metric, reconstructed exactly from due_date vs
  // actual_return_date rather than tracked separately.
  const checkoutsPerDay = useMemo(
    () => bucketWeightedByDay(items.map((i) => [i.loan_date, i.quantity]), 14),
    [items],
  );
  const returnsPerDay = useMemo(
    () =>
      bucketWeightedByDay(
        items.filter((i) => i.actual_return_date).map((i) => [i.actual_return_date as string, i.quantity]),
        14,
      ),
    [items],
  );
  // "Yêu cầu gia hạn đang chờ" is a backlog SIZE, not a daily arrival count — its
  // sparkline/trend must track that same backlog over time (weekOverWeekLevel), not
  // the volume of new renew requests per day (weekOverWeek), a different number that
  // has no fixed relationship to the "currently pending" headline it sits under.
  const renewRequestsPerDay = useMemo(
    () => pendingCountSeries((allLoanRequests ?? []).filter((r) => r.kind === "renew"), 14),
    [allLoanRequests],
  );
  const overduePerDay = useMemo(() => overdueCountSeries(items, 14), [items]);

  const checkoutsTrend = useMemo(() => weekOverWeek(checkoutsPerDay), [checkoutsPerDay]);
  const returnsTrend = useMemo(() => weekOverWeek(returnsPerDay), [returnsPerDay]);
  const renewRequestsTrend = useMemo(() => weekOverWeekLevel(renewRequestsPerDay), [renewRequestsPerDay]);
  const overdueTrend = useMemo(() => weekOverWeekLevel(overduePerDay), [overduePerDay]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTab =
        tab === "borrowing"
          ? item.status === "borrowing" && !item.is_overdue
          : tab === "returned"
            ? item.status === "returned"
            : tab === "overdue"
              ? item.is_overdue
              : item.renewed;
      const matchesQuery =
        !query ||
        item.reader_name.toLowerCase().includes(query) ||
        item.book_title.toLowerCase().includes(query) ||
        item.reader_code.toLowerCase().includes(query);
      return matchesTab && matchesQuery;
    });
  }, [items, tab, search]);

  const recent = items.slice(0, 4);

  return (
    <div className="flex h-full flex-col gap-2 animate-fade-in">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          label="Hôm nay đã mượn"
          value={stats.checkoutsToday}
          icon={SignIn}
          tone="info"
          sparkline={checkoutsPerDay}
          trend={checkoutsTrend}
        />
        <StatTile
          label="Hôm nay đã trả"
          value={stats.returnsToday}
          icon={CheckCircle}
          tone="success"
          sparkline={returnsPerDay}
          trend={returnsTrend}
        />
        <StatTile
          label="Yêu cầu gia hạn đang chờ"
          value={stats.renewRequests}
          icon={ArrowsClockwise}
          tone="pending"
          sparkline={renewRequestsPerDay}
          trend={renewRequestsTrend}
        />
        <StatTile
          label="Sách đang quá hạn"
          value={stats.overdue}
          icon={Warning}
          tone="warning"
          sparkline={overduePerDay}
          trend={overdueTrend}
        />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
        <p className="mb-2 font-heading text-sm font-semibold">Độc giả mượn nhiều nhất</p>
        {isLoading ? <Skeleton className="h-20 w-full" /> : <TopBorrowers items={items} />}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 lg:col-span-2">
          <div className="flex-none border-b border-border p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <p className="font-heading text-sm font-semibold">Nhật ký hoạt động</p>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo độc giả, sách…"
                className="w-full max-w-[220px] rounded-full border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex-none rounded-full px-3 py-1.5 text-sm transition-colors ${
                    tab === t.key
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Độc giả</th>
                  <th className="px-4 py-3">Sách</th>
                  <th className="px-4 py-3">Hạn trả</th>
                  <th className="px-4 py-3">Còn lại</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3" colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Không có hoạt động nào khớp.
                    </td>
                  </tr>
                )}
                {filtered.map((item) => (
                  <tr key={`${item.loan_id}-${item.book_id}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={item.reader_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.reader_name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">ID: {item.reader_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="truncate font-medium">{item.book_title}</p>
                      <button
                        type="button"
                        onClick={() => handleViewLoan(item.loan_id)}
                        className="block truncate font-mono text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {item.loan_code}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{formatShortDate(item.due_date)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{daysLeftLabel(item)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={loanDetailStatus(item.status, item.due_date)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid min-h-0 grid-rows-2 gap-2">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
            <div className="mb-2 flex flex-none items-center justify-between">
              <p className="font-heading text-sm font-semibold">Yêu cầu từ độc giả</p>
              {!!pendingLoanRequests?.length && (
                <span className="rounded-full bg-pending px-2 py-0.5 text-xs font-medium text-pending-foreground">
                  {pendingLoanRequests.length} đang chờ
                </span>
              )}
            </div>
            {!pendingLoanRequests?.length ? (
              <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ.</p>
            ) : (
              <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {pendingLoanRequests.slice(0, 4).map((req) => (
                  <PendingRequestRow key={req.id} request={req} onViewLoan={handleViewLoan} />
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
            <p className="mb-2 flex-none font-heading text-sm font-semibold">Hoạt động gần đây</p>
            {isLoading && <Skeleton className="h-40 w-full" />}
            {!isLoading && recent.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
            )}
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {recent.map((item) => (
                <li key={`${item.loan_id}-${item.book_id}`} className="flex items-center gap-2.5 text-sm">
                  <div className="h-10 w-7 flex-none overflow-hidden rounded">
                    <BookCover src={item.book_cover_image_url} title={item.book_title} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewLoan(item.loan_id)}
                    className="min-w-0 flex-1 text-left hover:underline"
                  >
                    <p className="truncate font-medium">{item.book_title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.reader_name}</p>
                  </button>
                  <StatusBadge status={loanDetailStatus(item.status, item.due_date)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {viewLoanId && (
        <LoanDetailModal loanId={viewLoanId} renewal={viewRenewal} onClose={() => setViewLoanId(null)} />
      )}
    </div>
  );
}
