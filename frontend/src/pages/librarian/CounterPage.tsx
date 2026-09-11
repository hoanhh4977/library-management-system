import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Clock, Warning } from "@phosphor-icons/react";

import { ReaderPicker } from "../../components/readers/ReaderPicker";
import { NewLoanForm } from "../../components/loans/NewLoanForm";
import { LoanDetailsTable } from "../../components/loans/LoanDetailsTable";
import { LoanDetailModal } from "../../components/loans/LoanDetailModal";
import { BookCover } from "../../components/books/BookCover";
import { StatusBadge, loanDetailStatus } from "../../components/StatusBadge";
import { useReaderLoans } from "../../hooks/useLoans";
import { usePendingLoanRequests } from "../../hooks/useLoanRequests";
import { useActivityLog, useActivityTrend, useOverdueReport } from "../../hooks/useReports";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { weekOverWeek } from "../../lib/trend";
import type { Reader } from "../../types/reader";

export function CounterPage() {
  const [reader, setReader] = useState<Reader | null>(null);
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const { data: loans } = useReaderLoans(reader?.id);
  const { data: trend } = useActivityTrend(14);
  const { data: overdue } = useOverdueReport();
  const { data: pendingRequests } = usePendingLoanRequests();
  const { data: recentActivity, isLoading: activityLoading } = useActivityLog(8);

  usePageHeader({ title: "Quầy giao dịch", subtitle: "Lập phiếu mượn, trả sách và gia hạn cho độc giả" });

  const borrowedSparkline = useMemo(() => trend?.days.map((d) => d.borrowed), [trend]);
  const returnedSparkline = useMemo(() => trend?.days.map((d) => d.returned), [trend]);
  const borrowedTrend = useMemo(() => (borrowedSparkline ? weekOverWeek(borrowedSparkline) : undefined), [borrowedSparkline]);
  const returnedTrend = useMemo(() => (returnedSparkline ? weekOverWeek(returnedSparkline) : undefined), [returnedSparkline]);
  const borrowedToday = trend?.days.at(-1)?.borrowed ?? 0;
  const returnedToday = trend?.days.at(-1)?.returned ?? 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Đang mượn hôm nay"
          value={borrowedToday}
          icon={ArrowUpRight}
          tone="info"
          sparkline={borrowedSparkline}
          trend={borrowedTrend}
        />
        <StatTile
          label="Trả hôm nay"
          value={returnedToday}
          icon={ArrowDownLeft}
          tone="success"
          sparkline={returnedSparkline}
          trend={returnedTrend}
        />
        <StatTile label="Sách quá hạn" value={overdue?.items.length ?? 0} icon={Warning} tone="warning" />
        <StatTile label="Yêu cầu đang chờ" value={pendingRequests?.length ?? 0} icon={Clock} tone="pending" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ReaderPicker selected={reader} onSelect={setReader} />

          {reader && (
            <>
              <NewLoanForm readerId={reader.id} cardStatus={reader.library_card?.status} onDone={() => {}} />
              <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-5">
                <p className="mb-3 font-heading text-sm font-semibold">Phiếu mượn của độc giả</p>
                <LoanDetailsTable loans={loans ?? []} />
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20">
          <p className="border-b border-border p-4 font-heading text-sm font-semibold">Hoạt động gần đây</p>
          {activityLoading && (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          )}
          {!activityLoading && (recentActivity?.items.length ?? 0) === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
          )}
          <ul className="flex flex-col gap-1 p-2">
            {recentActivity?.items.map((item) => (
              <li key={`${item.loan_id}-${item.book_id}`}>
                <button
                  type="button"
                  onClick={() => setViewLoanId(item.loan_id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted"
                >
                  <BookCover src={item.book_cover_image_url} title={item.book_title} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.book_title}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BookOpen size={11} aria-hidden="true" /> {item.reader_name}
                    </p>
                  </div>
                  <StatusBadge status={loanDetailStatus(item.status, item.due_date)} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {viewLoanId && <LoanDetailModal loanId={viewLoanId} onClose={() => setViewLoanId(null)} />}
    </div>
  );
}
