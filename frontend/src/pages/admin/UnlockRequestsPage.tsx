import { usePendingUnlockRequests, useReviewUnlock } from "../../hooks/useCards";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";

export function UnlockRequestsPage() {
  const { data: requests, isLoading } = usePendingUnlockRequests();
  const review = useReviewUnlock();

  usePageHeader({ title: "Yêu cầu mở khóa thẻ", subtitle: "Duyệt yêu cầu mở khóa thẻ thư viện bị khóa do quá hạn" });

  return (
    <div>
      {isLoading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
      {!isLoading && requests?.length === 0 && (
        <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
      )}

      <ul className="flex flex-col gap-2">
        {requests?.map((req) => (
          <li
            key={req.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
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
  );
}
