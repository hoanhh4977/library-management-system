import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { ArrowRight, BookOpen, BookOpenText, DownloadSimple, Stack, Tray } from "@phosphor-icons/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { useInventoryReport } from "../../hooks/useReports";
import type { BookInventory } from "../../hooks/useReports";
import { usePendingLoanRequests } from "../../hooks/useLoanRequests";
import { usePendingUnlockRequests } from "../../hooks/useCards";
import { BookCover } from "../../components/books/BookCover";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";

const DONUT_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-track)"];

const TILE_TONE_CLASSES = {
  info: "bg-info text-info-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  pending: "bg-pending text-pending-foreground",
} as const;

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof BookOpen;
  tone: keyof typeof TILE_TONE_CLASSES;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${TILE_TONE_CLASSES[tone]}`}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="font-mono text-2xl font-bold text-foreground">{value.toLocaleString("vi-VN")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

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
    <div className="flex items-center gap-4" role="img" aria-label={`Tỷ trọng thể loại được mượn: ${summary}`}>
      <div className="relative h-36 w-36 flex-none" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={totalsByCategory.entries.map(([category, value]) => ({ name: category, value }))}
              dataKey="value"
              nameKey="name"
              innerRadius={45}
              outerRadius={65}
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
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DONUT_COLORS[0] }} />
          <span className="mt-1 text-xs font-semibold">{top[0]}</span>
          <span className="text-xs text-muted-foreground">
            {Math.round((top[1] / totalsByCategory.total) * 100)}% · {top[1]} lượt
          </span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm" aria-hidden="true">
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

/** Highlight card for the single most-borrowed title — ref: "Top Borrowed Books". */
function TopBorrowedBook({ books }: { books: BookInventory[] }) {
  const top = [...books].sort((a, b) => b.borrowing - a.borrowing)[0];
  if (!top || top.borrowing === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có sách nào đang được mượn.</p>;
  }
  return (
    <div className="flex gap-3">
      <div className="h-24 w-16 flex-none overflow-hidden rounded-lg">
        <BookCover src={top.cover_image_url} title={top.title} />
      </div>
      <div className="min-w-0">
        <span className="mb-1 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {top.category}
        </span>
        <p className="truncate text-sm text-muted-foreground">{top.author}</p>
        <p className="truncate font-heading text-base font-semibold">{top.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Đang mượn: <span className="font-mono font-semibold text-foreground">{top.borrowing}</span> · Còn lại:{" "}
          <span className="font-mono font-semibold text-foreground">{top.remaining}</span>
        </p>
      </div>
    </div>
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
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold">
            #{index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{author}</p>
            <p className="text-xs text-muted-foreground">{stats.titles} đầu sách</p>
          </div>
          <span className="flex-none font-mono text-sm font-semibold">{stats.borrowing}</span>
        </li>
      ))}
    </ul>
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

export function DashboardPage() {
  const { data: report, isLoading } = useInventoryReport();
  const { data: pendingLoanRequests } = usePendingLoanRequests();
  const { data: pendingUnlockRequests } = usePendingUnlockRequests();

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
    return <p className="text-sm text-muted-foreground">Đang tải báo cáo…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Tổng đầu sách" value={report.total_titles} icon={BookOpenText} tone="info" />
        <StatTile label="Tổng số bản" value={report.total_copies} icon={Stack} tone="success" />
        <StatTile label="Đang được mượn" value={report.total_borrowing} icon={BookOpen} tone="warning" />
        <StatTile
          label="Yêu cầu đang chờ"
          value={(pendingLoanRequests?.length ?? 0) + (pendingUnlockRequests?.length ?? 0)}
          icon={Tray}
          tone="pending"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-heading text-sm font-semibold">Thể loại được mượn nhiều nhất</p>
          <CategoryDonut books={report.books} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 font-heading text-sm font-semibold">Sách được mượn nhiều nhất</p>
          <TopBorrowedBook books={report.books} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card lg:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Sách</th>
                <th className="px-4 py-3 text-right">Tổng số bản</th>
                <th className="px-4 py-3 text-right">Đang mượn</th>
                <th className="px-4 py-3 text-right">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {report.books.map((book) => (
                <tr key={book.book_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-11 w-8 flex-none overflow-hidden rounded-md">
                        <BookCover src={book.cover_image_url} title={book.title} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{book.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{book.total}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{book.borrowing}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{book.remaining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-heading text-sm font-semibold">Yêu cầu từ độc giả</p>
              <NavLink to="/librarian/requests" className="flex items-center gap-1 text-xs text-accent">
                Xem tất cả <ArrowRight size={12} aria-hidden="true" />
              </NavLink>
            </div>
            {!pendingLoanRequests?.length ? (
              <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {pendingLoanRequests.slice(0, 3).map((req) => (
                  <li key={req.id} className="flex items-center gap-2.5 text-sm">
                    <div className="h-10 w-7 flex-none overflow-hidden rounded">
                      <BookCover src={req.items[0]?.book_cover_image_url ?? null} title={req.reader_name} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{req.reader_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {req.kind === "borrow" ? req.items[0]?.book_title : `Gia hạn ${req.loan_code}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 font-heading text-sm font-semibold">Tác giả nổi bật</p>
            <TopAuthors books={report.books} />
          </div>
        </div>
      </div>
    </div>
  );
}
