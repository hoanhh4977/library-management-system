import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BookOpenText,
  CaretLeft,
  CaretRight,
  CheckCircle,
  DownloadSimple,
  Medal,
  Stack,
  Tray,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useActivityTrend, useInventoryReport, useOverdueReport } from "../../hooks/useReports";
import type { BookInventory, DailyActivity, OverdueItem } from "../../hooks/useReports";
import { useAllLoanRequests, usePendingLoanRequests } from "../../hooks/useLoanRequests";
import { useAllUnlockRequests, usePendingUnlockRequests } from "../../hooks/useCards";
import { useAllReaders } from "../../hooks/useReaders";
import { BookCover } from "../../components/books/BookCover";
import { LoanDetailModal, type LoanRenewalContext } from "../../components/loans/LoanDetailModal";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { SemicircleGauge } from "../../components/charts/SemicircleGauge";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import {
  bucketByDay,
  bucketWeightedByDay,
  formatShortDate,
  pendingCountSeries,
  weekOverWeekLevel,
} from "../../lib/trend";

const DONUT_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-track)"];

// Gold / silver / bronze — a real-world medal-tier convention, not one of the app's
// semantic status colors, so it's kept local to this one leaderboard rather than a token.
const MEDAL_COLORS = ["#D4AF37", "#A8A9AD", "#B08D57"];

const DONUT_MAX_SLICES = 5;

/** Donut of borrowing volume by book category — ref: "Most Borrowed Categories".
 * Capped at 5 slices + an "Khác" bucket (chart guidance: pie/donut degrades past
 * ~6 slices); paired with an aria-label summary and a sr-only table so the
 * breakdown doesn't depend on hovering the chart. */
function CategoryDonut({ books }: { books: BookInventory[] }) {
  const totalsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const book of books) map.set(book.category, (map.get(book.category) ?? 0) + book.borrowing);
    const sorted = [...map.entries()].filter(([, borrowing]) => borrowing > 0).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [, v]) => sum + v, 0);

    const top = sorted.slice(0, DONUT_MAX_SLICES);
    const rest = sorted.slice(DONUT_MAX_SLICES);
    const restTotal = rest.reduce((sum, [, v]) => sum + v, 0);
    const entries: [string, number][] = restTotal > 0 ? [...top, ["Khác", restTotal]] : top;

    return { entries, total };
  }, [books]);

  if (totalsByCategory.total === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có sách nào đang được mượn.</p>;
  }

  const top = totalsByCategory.entries[0];
  const summary = totalsByCategory.entries
    .map(([category, value]) => `${category} ${Math.round((value / totalsByCategory.total) * 100)}%`)
    .join(", ");

  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Tỷ trọng thể loại được mượn: ${summary}`}>
      <div className="relative h-28 w-28 flex-none" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={totalsByCategory.entries.map(([category, value]) => ({ name: category, value }))}
              dataKey="value"
              nameKey="name"
              innerRadius={36}
              outerRadius={52}
              paddingAngle={2}
              stroke="none"
            >
              {totalsByCategory.entries.map((_, index) => (
                <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} lượt mượn`, name]}
              contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-bold text-foreground">
            {Math.round((top[1] / totalsByCategory.total) * 100)}%
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground">{top[1]} lượt</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm" aria-hidden="true">
        {totalsByCategory.entries.map(([category, value], index) => (
          <li key={category} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span className="truncate">{category}</span>
            </span>
            <span className="flex-none rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {Math.round((value / totalsByCategory.total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Tỷ trọng thể loại được mượn</caption>
        <thead>
          <tr>
            <th scope="col">Thể loại</th>
            <th scope="col">Lượt mượn</th>
            <th scope="col">Tỷ lệ</th>
          </tr>
        </thead>
        <tbody>
          {totalsByCategory.entries.map(([category, value]) => (
            <tr key={category}>
              <td>{category}</td>
              <td>{value}</td>
              <td>{Math.round((value / totalsByCategory.total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOP_BORROWED_LIMIT = 5;

/** Paged carousel of the most-borrowed titles — ref: "Top Borrowed Books". Only
 * titles with borrowing > 0 are eligible so the carousel doesn't pad itself with
 * books nobody currently has out. */
function TopBorrowedBooks({ books }: { books: BookInventory[] }) {
  const ranked = useMemo(
    () =>
      [...books]
        .filter((b) => b.borrowing > 0)
        .sort((a, b) => b.borrowing - a.borrowing)
        .slice(0, TOP_BORROWED_LIMIT),
    [books],
  );
  const [index, setIndex] = useState(0);

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có sách nào đang được mượn.</p>;
  }

  const current = ranked[Math.min(index, ranked.length - 1)];

  return (
    <div>
      <div className="flex gap-3">
        <div className="h-20 w-14 flex-none overflow-hidden rounded-lg">
          <BookCover src={current.cover_image_url} title={current.title} />
        </div>
        <div className="min-w-0">
          <span className="mb-1 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {current.category}
          </span>
          <p className="truncate text-sm text-muted-foreground">{current.author}</p>
          <p className="truncate font-heading text-sm font-semibold">{current.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Đang mượn: <span className="font-mono font-semibold text-foreground">{current.borrowing}</span> · Còn
            lại: <span className="font-mono font-semibold text-foreground">{current.remaining}</span>
          </p>
        </div>
      </div>

      {ranked.length > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1" role="tablist" aria-label="Sách được mượn nhiều nhất">
            {ranked.map((book, i) => (
              <button
                key={book.book_id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${book.title} (${i + 1}/${ranked.length})`}
                onClick={() => setIndex(i)}
                className={`h-1.5 w-4 rounded-full transition-colors ${i === index ? "bg-accent" : "bg-muted"}`}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + ranked.length) % ranked.length)}
              aria-label="Sách trước"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            >
              <CaretLeft size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % ranked.length)}
              aria-label="Sách tiếp theo"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            >
              <CaretRight size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Real borrow/return volume trend — ref: Bookary "Check-Ins vs Borrowing Trend".
 * Built from `loans.loan_date` + `loan_details.actual_return_date`, both already
 * recorded on every transaction (`GET /api/reports/trend`) — no fabricated history. */
function ActivityTrendChart({ days }: { days: DailyActivity[] }) {
  const hasActivity = days.some((d) => d.borrowed > 0 || d.returned > 0);
  const chartData = days.map((d) => ({
    date: formatShortDate(d.activity_date),
    "Đã mượn": d.borrowed,
    "Đã trả": d.returned,
  }));

  return (
    <div>
      {!hasActivity && (
        <p className="mb-3 text-sm text-muted-foreground">
          Chưa có hoạt động mượn/trả nào trong {days.length} ngày qua.
        </p>
      )}
      <div className="h-20 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="fillBorrowed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillReturned" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-chart-3)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={22}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="Đã mượn"
              stroke="var(--color-chart-1)"
              fill="url(#fillBorrowed)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Đã trả"
              stroke="var(--color-chart-3)"
              fill="url(#fillReturned)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Số lượt mượn và trả sách theo ngày</caption>
        <thead>
          <tr>
            <th scope="col">Ngày</th>
            <th scope="col">Đã mượn</th>
            <th scope="col">Đã trả</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.activity_date}>
              <td>{d.activity_date}</td>
              <td>{d.borrowed}</td>
              <td>{d.returned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** All currently-overdue loan lines — real per-loan data from `GET /api/reports/overdue`
 * (`loans.due_date` + `loan_details.status`), replacing the redundant full book table
 * that duplicated the "Quản lý Sách" page. */
function OverdueTable({
  items,
  onViewLoan,
  onViewReaderRequests,
}: {
  items: OverdueItem[];
  onViewLoan: (loanId: string) => void;
  onViewReaderRequests: (readerId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CheckCircle size={28} className="text-success-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Không có phiếu mượn nào quá hạn.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="px-4 py-3">Sách</th>
          <th className="px-4 py-3">Độc giả</th>
          <th className="px-4 py-3">Hạn trả</th>
          <th className="px-4 py-3 text-right">Quá hạn</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.loan_id}-${item.book_id}`} className="border-b border-border last:border-0">
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-11 w-8 flex-none overflow-hidden rounded-md">
                  <BookCover src={item.book_cover_image_url} title={item.book_title} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.book_title}</p>
                  <button
                    type="button"
                    onClick={() => onViewLoan(item.loan_id)}
                    className="block truncate font-mono text-xs text-accent underline-offset-2 hover:underline"
                  >
                    {item.loan_code}
                  </button>
                </div>
              </div>
            </td>
            <td className="px-4 py-2.5">
              <button
                type="button"
                onClick={() => onViewReaderRequests(item.reader_id)}
                className="block text-left hover:underline"
                title="Xử lý yêu cầu của độc giả này"
              >
                <p className="truncate font-medium text-accent">{item.reader_name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{item.reader_code}</p>
              </button>
            </td>
            <td className="px-4 py-2.5 font-mono text-muted-foreground">{formatShortDate(item.due_date)}</td>
            <td className="px-4 py-2.5 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground">
                <Warning size={13} aria-hidden="true" />
                {item.days_overdue} ngày
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Books ranked by total borrowing summed across titles — ref: "Top Authors". */
function TopAuthors({ books }: { books: BookInventory[] }) {
  const ranked = useMemo(() => {
    const map = new Map<string, { titles: number; borrowing: number }>();
    for (const book of books) {
      const entry = map.get(book.author) ?? { titles: 0, borrowing: 0 };
      entry.titles += 1;
      entry.borrowing += book.borrowing;
      map.set(book.author, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].borrowing - a[1].borrowing).slice(0, 3);
  }, [books]);

  if (ranked.every(([, v]) => v.borrowing === 0)) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {ranked.map(([author, stats], index) => (
        <li key={author} className="flex items-center gap-3">
          <span
            className="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <Medal size={20} weight="fill" style={{ color: MEDAL_COLORS[index] }} />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-card font-mono text-[9px] font-bold text-foreground">
              {index + 1}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {author} <span className="sr-only">— hạng {index + 1}</span>
            </p>
            <p className="text-xs text-muted-foreground">{stats.titles} đầu sách</p>
          </div>
          <span className="flex-none font-mono text-sm font-semibold">{stats.borrowing}</span>
        </li>
      ))}
    </ul>
  );
}

/** Half-donut breakdown of total copies — ref: Bookary "Stock Overview". Real
 * data only: `remaining` (available) + `borrowing`, summed across all titles. */
function StockOverview({ books }: { books: BookInventory[] }) {
  const remaining = books.reduce((sum, b) => sum + b.remaining, 0);
  const borrowing = books.reduce((sum, b) => sum + b.borrowing, 0);
  const total = remaining + borrowing;

  const segments = [
    { label: "Còn lại", value: remaining, color: "var(--color-chart-1)" },
    { label: "Đang mượn", value: borrowing, color: "var(--color-chart-3)" },
  ];

  return (
    <div>
      <SemicircleGauge segments={segments} centerLabel="Tổng số bản" centerValue={total} />
      {total === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Chưa có bản sách nào trong kho.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                {segment.label}
              </span>
              <span className="font-mono font-semibold">{segment.value.toLocaleString("vi-VN")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function downloadInventoryCsv(books: BookInventory[]) {
  const header = ["Mã sách", "Tên sách", "Tác giả", "Thể loại", "Tổng số bản", "Đang mượn", "Còn lại"];
  const rows = books.map((b) => [b.code, b.title, b.author, b.category, b.total, b.borrowing, b.remaining]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ton-kho-sach.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/** Mirrors the loaded layout's shape (stat row → trend → 3-col charts → overdue+sidebar)
 * so the transition into real data is a settle-in, not a layout jump. */
function DashboardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-3">
            <Skeleton className="mb-2 h-7 w-7 rounded-xl" />
            <Skeleton className="mb-1.5 h-5 w-10" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-3">
        <Skeleton className="mb-2 h-4 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-3">
            <Skeleton className="mb-3 h-4 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-3 lg:col-span-2">
          <Skeleton className="mb-3 h-4 w-28" />
          <Skeleton className="mb-2 h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: report, isLoading } = useInventoryReport();
  const { data: trend } = useActivityTrend(14);
  const { data: overdue } = useOverdueReport();
  const { data: pendingLoanRequests } = usePendingLoanRequests();
  const { data: pendingUnlockRequests } = usePendingUnlockRequests();
  const { data: allLoanRequests } = useAllLoanRequests();
  const { data: allUnlockRequests } = useAllUnlockRequests();
  const { data: readers } = useAllReaders();
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const [viewRenewal, setViewRenewal] = useState<LoanRenewalContext | undefined>(undefined);
  const handleViewLoan = (loanId: string, renewal?: LoanRenewalContext) => {
    setViewLoanId(loanId);
    setViewRenewal(renewal);
  };

  const activeReaders = useMemo(
    () => readers?.filter((r) => r.library_card?.status === "active").length ?? 0,
    [readers],
  );

  // Real daily series, each built from a timestamp field that already exists on the
  // underlying table (migration 0004_book_created_at added one to `books` so the
  // catalog-size tiles could get a real trend too — no fabricated numbers anywhere here).
  // "Đang được mượn" is a backlog SIZE (books currently out on loan right now), not a
  // daily-borrow-count — reconstruct the exact level per day by walking the real
  // borrowed/returned deltas backward from today's live total_borrowing snapshot
  // (report.total_borrowing), then track that with weekOverWeekLevel.
  const borrowingSparkline = useMemo(() => {
    if (!trend || report?.total_borrowing == null) return undefined;
    const days = trend.days;
    const series = new Array<number>(days.length);
    let level = report.total_borrowing;
    series[days.length - 1] = level;
    for (let i = days.length - 1; i >= 1; i--) {
      level = level - days[i].borrowed + days[i].returned;
      series[i - 1] = level;
    }
    return series;
  }, [trend, report]);
  const borrowingTrend = useMemo(
    () => (borrowingSparkline ? weekOverWeekLevel(borrowingSparkline) : undefined),
    [borrowingSparkline],
  );

  const readersSparkline = useMemo(() => {
    if (!readers) return undefined;
    const issuedDates = readers
      .filter((r) => r.library_card?.status === "active")
      .map((r) => r.library_card!.issued_at);
    const newPerDay = bucketByDay(issuedDates, 14);
    // Cumulative so the line reflects the actual active-member count growing,
    // matching what the tile's headline number represents.
    const startingCount = activeReaders - newPerDay.reduce((sum, v) => sum + v, 0);
    let running = startingCount;
    return newPerDay.map((v) => (running += v));
  }, [readers, activeReaders]);
  const readersTrend = useMemo(
    () => (readersSparkline ? weekOverWeekLevel(readersSparkline) : undefined),
    [readersSparkline],
  );

  // "Yêu cầu đang chờ" is a backlog SIZE (currently-pending loan + unlock requests),
  // not a daily arrival count — track that same backlog over time (weekOverWeekLevel),
  // not the volume of new requests per day (weekOverWeek), an unrelated number.
  const requestsSparkline = useMemo(() => {
    if (!allLoanRequests || !allUnlockRequests) return undefined;
    const loanPending = pendingCountSeries(allLoanRequests, 14);
    const unlockPending = pendingCountSeries(allUnlockRequests, 14);
    return loanPending.map((v, i) => v + unlockPending[i]);
  }, [allLoanRequests, allUnlockRequests]);
  const requestsTrend = useMemo(
    () => (requestsSparkline ? weekOverWeekLevel(requestsSparkline) : undefined),
    [requestsSparkline],
  );

  // Cumulative catalog growth — real, from `books.created_at` (migration
  // 0004_book_created_at). Titles counts rows added per day; copies weights that
  // same bucket by each book's current total (an approximation for older rows whose
  // quantity was edited after creation, since only the creation moment is timestamped).
  const titlesSparkline = useMemo(() => {
    if (!report) return undefined;
    const newPerDay = bucketByDay(report.books.map((b) => b.created_at), 14);
    const startingCount = report.total_titles - newPerDay.reduce((sum, v) => sum + v, 0);
    let running = startingCount;
    return newPerDay.map((v) => (running += v));
  }, [report]);
  const titlesTrend = useMemo(
    () => (titlesSparkline ? weekOverWeekLevel(titlesSparkline) : undefined),
    [titlesSparkline],
  );

  const copiesSparkline = useMemo(() => {
    if (!report) return undefined;
    const addedPerDay = bucketWeightedByDay(
      report.books.map((b) => [b.created_at, b.total]),
      14,
    );
    const startingCount = report.total_copies - addedPerDay.reduce((sum, v) => sum + v, 0);
    let running = startingCount;
    return addedPerDay.map((v) => (running += v));
  }, [report]);
  const copiesTrend = useMemo(
    () => (copiesSparkline ? weekOverWeekLevel(copiesSparkline) : undefined),
    [copiesSparkline],
  );

  usePageHeader({
    title: "Tổng quan",
    subtitle: "Theo dõi toàn bộ hoạt động tồn kho thư viện",
    action: report && (
      <button
        type="button"
        onClick={() => downloadInventoryCsv(report.books)}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        <DownloadSimple size={16} aria-hidden="true" /> Tải CSV
      </button>
    ),
  });

  if (isLoading || !report) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex h-full flex-col gap-2 animate-fade-in">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatTile
          label="Tổng đầu sách"
          value={report.total_titles}
          icon={BookOpenText}
          tone="info"
          sparkline={titlesSparkline}
          trend={titlesTrend}
        />
        <StatTile
          label="Tổng số bản"
          value={report.total_copies}
          icon={Stack}
          tone="success"
          sparkline={copiesSparkline}
          trend={copiesTrend}
        />
        <StatTile
          label="Đang được mượn"
          value={report.total_borrowing}
          icon={BookOpen}
          tone="warning"
          sparkline={borrowingSparkline}
          trend={borrowingTrend}
        />
        <StatTile
          label="Độc giả hoạt động"
          value={activeReaders}
          icon={UsersThree}
          tone="info"
          sparkline={readersSparkline}
          trend={readersTrend}
        />
        <StatTile
          label="Yêu cầu đang chờ"
          value={(pendingLoanRequests?.length ?? 0) + (pendingUnlockRequests?.length ?? 0)}
          icon={Tray}
          tone="pending"
          sparkline={requestsSparkline}
          trend={requestsTrend}
        />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold">Xu hướng mượn — trả sách (14 ngày qua)</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-chart-1)" }} />
              Đã mượn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-chart-3)" }} />
              Đã trả
            </span>
          </div>
        </div>
        {trend ? <ActivityTrendChart days={trend.days} /> : <Skeleton className="h-20 w-full" />}
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
          <p className="mb-1.5 font-heading text-sm font-semibold">Thể loại được mượn nhiều nhất</p>
          <CategoryDonut books={report.books} />
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
          <p className="mb-1.5 font-heading text-sm font-semibold">Sách được mượn nhiều nhất</p>
          <TopBorrowedBooks books={report.books} />
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
          <p className="mb-0.5 font-heading text-sm font-semibold">Tổng quan kho sách</p>
          <StockOverview books={report.books} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 lg:col-span-2">
          <div className="flex flex-none items-center justify-between border-b border-border px-4 py-2.5">
            <p className="font-heading text-sm font-semibold">Sách quá hạn trả</p>
            <NavLink to="/admin/books" className="flex items-center gap-1 text-xs text-accent">
              Quản lý Sách <ArrowRight size={12} aria-hidden="true" />
            </NavLink>
          </div>
          <div className="overflow-y-auto">
            {overdue ? (
              <OverdueTable
                items={overdue.items}
                onViewLoan={handleViewLoan}
                onViewReaderRequests={(readerId) => navigate(`/admin/requests?reader=${readerId}`)}
              />
            ) : (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            )}
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-2">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
            <div className="mb-1.5 flex flex-none items-center justify-between">
              <p className="font-heading text-sm font-semibold">Yêu cầu từ độc giả</p>
              <NavLink to="/admin/activities" className="flex items-center gap-1 text-xs text-accent">
                Xem tất cả <ArrowRight size={12} aria-hidden="true" />
              </NavLink>
            </div>
            {!pendingLoanRequests?.length ? (
              <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ.</p>
            ) : (
              <ul className="flex flex-col gap-2 overflow-y-auto">
                {pendingLoanRequests.slice(0, 2).map((req) => (
                  <li key={req.id} className="flex items-center gap-2.5 text-sm">
                    <div className="h-10 w-7 flex-none overflow-hidden rounded">
                      <BookCover src={req.items[0]?.book_cover_image_url ?? null} title={req.reader_name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{req.reader_name}</p>
                      {req.kind === "borrow" ? (
                        <p className="truncate text-xs text-muted-foreground">{req.items[0]?.book_title}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            req.loan_id &&
                            handleViewLoan(req.loan_id, {
                              extensionDays: req.extension_days ?? 7,
                              status: req.status,
                            })
                          }
                          className="truncate text-left text-xs text-accent underline-offset-2 hover:underline"
                        >
                          Gia hạn {req.loan_code}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-muted/30 p-3">
            <p className="mb-1.5 flex-none font-heading text-sm font-semibold">Tác giả nổi bật</p>
            <div className="overflow-y-auto">
              <TopAuthors books={report.books} />
            </div>
          </div>
        </div>
      </div>

      {viewLoanId && (
        <LoanDetailModal loanId={viewLoanId} renewal={viewRenewal} onClose={() => setViewLoanId(null)} />
      )}
    </div>
  );
}
