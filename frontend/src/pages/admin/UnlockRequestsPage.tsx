import { useMemo } from "react";
import { CheckCircle, Clock, Lock, XCircle } from "@phosphor-icons/react";

import { useAllUnlockRequests, usePendingUnlockRequests, useReviewUnlock } from "../../hooks/useCards";
import { useAllReaders } from "../../hooks/useReaders";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { StatusBadge } from "../../components/StatusBadge";
import { formatShortDate, pendingCountSeries, weekOverWeekLevel } from "../../lib/trend";

export function UnlockRequestsPage() {
  const { data: requests, isLoading } = usePendingUnlockRequests();
  const { data: allRequests } = useAllUnlockRequests();
  const { data: readers } = useAllReaders();
  const review = useReviewUnlock();

  usePageHeader({ title: "Yêu cầu mở khóa thẻ", subtitle: "Duyệt yêu cầu mở khóa thẻ thư viện bị khóa do quá hạn" });

  const lockedCards = readers?.filter((r) => r.library_card?.status === "locked").length ?? 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const items = allRequests ?? [];
    const approvedToday = items.filter(
      (r) => r.status === "approved" && r.reviewed_at?.slice(0, 10) === todayStr,
    ).length;
    const rejectedToday = items.filter(
      (r) => r.status === "rejected" && r.reviewed_at?.slice(0, 10) === todayStr,
    ).length;
    return { approvedToday, rejectedToday };
  }, [allRequests, todayStr]);

  // "Đang chờ duyệt" is a backlog SIZE (how many are pending right now), not a daily
  // arrival count — its sparkline/trend must track that same backlog over time
  // (weekOverWeekLevel), not the volume of new requests per day (weekOverWeek), which
  // is a different number that happens to share no relationship with "0 pending now".
  const pendingSparkline = useMemo(
    () => (allRequests ? pendingCountSeries(allRequests, 14) : undefined),
    [allRequests],
  );
  const pendingTrend = useMemo(
    () => (pendingSparkline ? weekOverWeekLevel(pendingSparkline) : undefined),
    [pendingSparkline],
  );

  const history = useMemo(
    () =>
      (allRequests ?? [])
        .filter((r) => r.status !== "pending")
        .sort((a, b) => (b.reviewed_at ?? b.requested_at).localeCompare(a.reviewed_at ?? a.requested_at))
        .slice(0, 8),
    [allRequests],
  );

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
        <StatTile label="Thẻ đang bị khóa" value={lockedCards} icon={Lock} tone="warning" />
      </div>

      <div className="mb-3 rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4">
        <p className="mb-3 font-heading text-sm font-semibold">Đang chờ duyệt</p>
        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}
        {!isLoading && requests?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <CheckCircle size={28} className="text-success-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {requests?.map((req) => (
            <li
              key={req.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{req.reader_name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {req.card_code} · gửi bởi {req.requested_by_name}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ cardId: req.card_id, requestId: req.id, decision: "reject" })}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ cardId: req.card_id, requestId: req.id, decision: "approve" })}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground"
                >
                  Phê duyệt
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20">
        <p className="border-b border-border p-4 font-heading text-sm font-semibold">Lịch sử gần đây</p>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Chưa có yêu cầu nào được xử lý.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Độc giả</th>
                <th className="px-4 py-3">Mã thẻ</th>
                <th className="px-4 py-3">Ngày yêu cầu</th>
                <th className="px-4 py-3">Ngày xử lý</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {history.map((req) => (
                <tr key={req.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{req.reader_name}</p>
                    <p className="text-xs text-muted-foreground">gửi bởi {req.requested_by_name}</p>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{req.card_code}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">
                    {formatShortDate(req.requested_at.slice(0, 10))}
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
        )}
      </div>
    </div>
  );
}
