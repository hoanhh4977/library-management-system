import { useState } from "react";
import { IdentificationCard } from "@phosphor-icons/react";

import { ReaderPicker } from "../../components/readers/ReaderPicker";
import { LoanDetailsTable } from "../../components/loans/LoanDetailsTable";
import { StatusBadge } from "../../components/StatusBadge";
import { useIssueCard } from "../../hooks/useReaders";
import { useReaderLoans } from "../../hooks/useLoans";
import { useRequestUnlock } from "../../hooks/useCards";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import type { Reader } from "../../types/reader";

export function ReadersPage() {
  const [reader, setReader] = useState<Reader | null>(null);
  const { data: loans } = useReaderLoans(reader?.id);
  const issueCard = useIssueCard();
  const requestUnlock = useRequestUnlock();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  usePageHeader({ title: "Độc giả", subtitle: "Cấp thẻ, mở khóa và tra cứu lịch sử mượn sách" });

  async function handleIssueCard() {
    if (!reader) return;
    try {
      await issueCard.mutateAsync(reader.id);
      setActionMessage(null);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Không thể cấp thẻ");
    }
  }

  async function handleRequestUnlock() {
    if (!reader?.library_card) return;
    try {
      await requestUnlock.mutateAsync(reader.library_card.id);
      setActionMessage("Đã gửi yêu cầu mở khóa tới Quản trị viên.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Không thể gửi yêu cầu mở khóa");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ReaderPicker selected={reader} onSelect={setReader} />

      {reader && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
            {reader.library_card ? (
              <>
                <StatusBadge status={reader.library_card.status} />
                <span className="font-mono text-sm text-muted-foreground">{reader.library_card.code}</span>
                {reader.library_card.status === "locked" && (
                  <button
                    type="button"
                    onClick={handleRequestUnlock}
                    disabled={requestUnlock.isPending}
                    className="ml-auto rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Gửi yêu cầu mở khóa
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleIssueCard}
                disabled={issueCard.isPending}
                className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              >
                <IdentificationCard size={16} aria-hidden="true" />
                Xác minh danh tính & cấp Thẻ thư viện
              </button>
            )}
          </div>

          {actionMessage && <p className="text-sm text-muted-foreground">{actionMessage}</p>}

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 font-heading text-sm font-semibold">Lịch sử mượn</p>
            <LoanDetailsTable loans={loans ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
