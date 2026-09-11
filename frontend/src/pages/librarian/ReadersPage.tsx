import { useCallback, useMemo, useState } from "react";
import { IdentificationCard, Lock, LockOpen, UserCircle, UsersThree } from "@phosphor-icons/react";

import { ReaderPicker } from "../../components/readers/ReaderPicker";
import { LoanDetailsTable } from "../../components/loans/LoanDetailsTable";
import { Avatar } from "../../components/Avatar";
import { StatusBadge } from "../../components/StatusBadge";
import { useAllReaders, useIssueCard } from "../../hooks/useReaders";
import { useReaderLoans } from "../../hooks/useLoans";
import { useRequestUnlock } from "../../hooks/useCards";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { bucketByDay, weekOverWeekLevel } from "../../lib/trend";
import type { Reader } from "../../types/reader";

export function ReadersPage() {
  const [reader, setReader] = useState<Reader | null>(null);
  const [search, setSearch] = useState("");
  const { data: loans } = useReaderLoans(reader?.id);
  const { data: readers, isLoading } = useAllReaders();
  const issueCard = useIssueCard();
  const requestUnlock = useRequestUnlock();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleSearchChange = useCallback((v: string) => setSearch(v), []);

  usePageHeader({
    title: "Độc giả",
    subtitle: "Cấp thẻ, mở khóa và tra cứu lịch sử mượn sách",
    search: { value: search, onChange: handleSearchChange, placeholder: "Tìm theo tên, mã, email…" },
  });

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

  const activeCards = readers?.filter((r) => r.library_card?.status === "active").length ?? 0;
  const lockedCards = readers?.filter((r) => r.library_card?.status === "locked").length ?? 0;

  const readersSparkline = useMemo(() => {
    if (!readers) return undefined;
    const newPerDay = bucketByDay(readers.map((r) => r.created_at), 14);
    const startingCount = readers.length - newPerDay.reduce((sum, v) => sum + v, 0);
    let running = startingCount;
    return newPerDay.map((v) => (running += v));
  }, [readers]);
  const readersTrend = useMemo(
    () => (readersSparkline ? weekOverWeekLevel(readersSparkline) : undefined),
    [readersSparkline],
  );

  const cardsIssuedThisWeek = useMemo(() => {
    const issuedDates = (readers ?? [])
      .filter((r) => r.library_card)
      .map((r) => r.library_card!.issued_at);
    return bucketByDay(issuedDates, 7).reduce((sum, v) => sum + v, 0);
  }, [readers]);

  const filteredReaders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return readers ?? [];
    return (readers ?? []).filter(
      (r) =>
        r.full_name.toLowerCase().includes(query) ||
        r.code.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query),
    );
  }, [readers, search]);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Tổng độc giả"
          value={readers?.length ?? 0}
          icon={UserCircle}
          tone="info"
          sparkline={readersSparkline}
          trend={readersTrend}
        />
        <StatTile label="Thẻ hoạt động" value={activeCards} icon={LockOpen} tone="success" />
        <StatTile label="Thẻ bị khóa" value={lockedCards} icon={Lock} tone="warning" />
        <StatTile label="Cấp thẻ tuần này" value={cardsIssuedThisWeek} icon={UsersThree} tone="pending" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <ReaderPicker selected={reader} onSelect={setReader} />

          {reader && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-4">
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

              <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20 p-5">
                <p className="mb-3 font-heading text-sm font-semibold">Lịch sử mượn</p>
                <LoanDetailsTable loans={loans ?? []} />
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20">
          <p className="border-b border-border p-4 font-heading text-sm font-semibold">Danh sách độc giả</p>
          {isLoading && (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          )}
          {!isLoading && filteredReaders.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Không tìm thấy độc giả.</p>
          )}
          <ul className="flex max-h-[540px] flex-col gap-1 overflow-y-auto p-2">
            {filteredReaders.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setReader(r)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted ${
                    reader?.id === r.id ? "bg-muted" : ""
                  }`}
                >
                  <Avatar name={r.full_name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.full_name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{r.code}</span>
                  </span>
                  {r.library_card ? (
                    <StatusBadge status={r.library_card.status} />
                  ) : (
                    <span className="flex-none text-xs text-muted-foreground">Chưa có thẻ</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
