import { useCallback, useMemo, useState } from "react";
import { Lock, LockOpen, Trash, UserCircle, UsersThree } from "@phosphor-icons/react";

import {
  useAllReaders,
  useAllLibrarians,
  useUpdateReader,
  useUpdateLibrarian,
  useDeleteReader,
  useDeleteLibrarian,
} from "../../hooks/useReaders";
import { StatusBadge } from "../../components/StatusBadge";
import { StatTile } from "../../components/StatTile";
import { Avatar } from "../../components/Avatar";
import { EditableCell } from "../../components/EditableCell";
import { Skeleton } from "../../components/Skeleton";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { ApiError } from "../../services/apiClient";
import { bucketByDay, weekOverWeekLevel } from "../../lib/trend";
import type { Librarian, Reader } from "../../types/reader";

function ConfirmDeleteDialog({
  title,
  description,
  onConfirm,
  onClose,
  isPending,
  error,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg">
        <h2 className="mb-1 font-heading text-lg font-semibold">{title}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
        {error && (
          <p role="alert" className="mb-3 text-sm text-danger-foreground">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Huỷ
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground disabled:opacity-60"
          >
            {isPending ? "Đang xoá…" : "Xoá tài khoản"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PeoplePage() {
  const [tab, setTab] = useState<"readers" | "librarians">("readers");
  const { data: readers } = useAllReaders();
  const { data: librarians } = useAllLibrarians();
  const updateReader = useUpdateReader();
  const updateLibrarian = useUpdateLibrarian();
  const deleteReader = useDeleteReader();
  const deleteLibrarian = useDeleteLibrarian();
  const [deletingReader, setDeletingReader] = useState<Reader | null>(null);
  const [deletingLibrarian, setDeletingLibrarian] = useState<Librarian | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cardStatusFilter, setCardStatusFilter] = useState<"" | "active" | "locked">("");

  async function handleConfirmDeleteReader() {
    if (!deletingReader) return;
    setDeleteError(null);
    try {
      await deleteReader.mutateAsync(deletingReader.id);
      setDeletingReader(null);
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Không thể xoá tài khoản độc giả.");
    }
  }

  async function handleConfirmDeleteLibrarian() {
    if (!deletingLibrarian) return;
    setDeleteError(null);
    try {
      await deleteLibrarian.mutateAsync(deletingLibrarian.id);
      setDeletingLibrarian(null);
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Không thể xoá tài khoản nhân viên.");
    }
  }

  const handleSearchChange = useCallback((v: string) => setSearch(v), []);

  usePageHeader({
    title: "Độc giả & Nhân viên",
    subtitle: "Quản lý hồ sơ độc giả và nhân viên thủ thư",
    search: { value: search, onChange: handleSearchChange, placeholder: "Tìm theo tên, mã, email…" },
  });

  const activeCards = readers?.filter((r) => r.library_card?.status === "active").length ?? 0;
  const lockedCards = readers?.filter((r) => r.library_card?.status === "locked").length ?? 0;

  // Real cumulative growth from `profiles.created_at` — same pattern as the
  // dashboard's "Độc giả hoạt động" tile.
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

  const filteredReaders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (readers ?? []).filter((r) => {
      const matchesQuery =
        !query ||
        r.full_name.toLowerCase().includes(query) ||
        r.code.toLowerCase().includes(query) ||
        r.email.toLowerCase().includes(query);
      const matchesStatus = !cardStatusFilter || r.library_card?.status === cardStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [readers, search, cardStatusFilter]);

  const filteredLibrarians = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return librarians ?? [];
    return (librarians ?? []).filter(
      (l) => l.full_name.toLowerCase().includes(query) || l.code.toLowerCase().includes(query),
    );
  }, [librarians, search]);

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
        <StatTile label="Tổng nhân viên" value={librarians?.length ?? 0} icon={UsersThree} tone="success" />
        <StatTile label="Thẻ hoạt động" value={activeCards} icon={LockOpen} tone="success" />
        <StatTile label="Thẻ bị khóa" value={lockedCards} icon={Lock} tone="warning" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab("readers")}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === "readers" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"}`}
          >
            Độc giả
          </button>
          <button
            type="button"
            onClick={() => setTab("librarians")}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === "librarians" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"}`}
          >
            Nhân viên thủ thư
          </button>
        </div>

        {tab === "readers" && (
          <select
            value={cardStatusFilter}
            onChange={(e) => setCardStatusFilter(e.target.value as typeof cardStatusFilter)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
            aria-label="Lọc theo trạng thái thẻ"
          >
            <option value="">Tất cả trạng thái thẻ</option>
            <option value="active">Hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
        )}
      </div>

      {tab === "readers" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Độc giả</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3">Thẻ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!readers &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {readers && filteredReaders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Không tìm thấy độc giả phù hợp.
                  </td>
                </tr>
              )}
              {filteredReaders.map((reader) => (
                <tr key={reader.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={reader.full_name} />
                      <div className="min-w-0 flex-1">
                        <EditableCell
                          value={reader.full_name}
                          valueClassName="font-medium"
                          onSave={(next) => updateReader.mutateAsync({ readerId: reader.id, full_name: next })}
                        />
                        <p className="font-mono text-xs text-muted-foreground">{reader.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{reader.email}</td>
                  <td className="px-4 py-2.5">
                    <EditableCell
                      value={reader.phone ?? ""}
                      placeholder="Chưa có SĐT"
                      type="tel"
                      onSave={(next) => updateReader.mutateAsync({ readerId: reader.id, phone: next })}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {reader.library_card ? <StatusBadge status={reader.library_card.status} /> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      aria-label="Xoá độc giả"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingReader(reader);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-danger hover:text-danger-foreground"
                    >
                      <Trash size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-gradient-to-b from-card to-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!librarians &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {librarians && filteredLibrarians.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Không tìm thấy nhân viên phù hợp.
                  </td>
                </tr>
              )}
              {filteredLibrarians.map((librarian) => (
                <tr key={librarian.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={librarian.full_name} />
                      <div className="min-w-0 flex-1">
                        <EditableCell
                          value={librarian.full_name}
                          valueClassName="font-medium"
                          onSave={(next) =>
                            updateLibrarian.mutateAsync({ librarianId: librarian.id, full_name: next })
                          }
                        />
                        <p className="font-mono text-xs text-muted-foreground">{librarian.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{librarian.email}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      aria-label="Xoá nhân viên"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingLibrarian(librarian);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-danger hover:text-danger-foreground"
                    >
                      <Trash size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deletingReader && (
        <ConfirmDeleteDialog
          title="Xoá tài khoản độc giả?"
          description={`Xoá "${deletingReader.full_name}" (${deletingReader.code}) khỏi hệ thống. Hành động này không thể hoàn tác.`}
          isPending={deleteReader.isPending}
          error={deleteError}
          onConfirm={handleConfirmDeleteReader}
          onClose={() => setDeletingReader(null)}
        />
      )}
      {deletingLibrarian && (
        <ConfirmDeleteDialog
          title="Xoá tài khoản nhân viên?"
          description={`Xoá "${deletingLibrarian.full_name}" (${deletingLibrarian.code}) khỏi hệ thống. Hành động này không thể hoàn tác.`}
          isPending={deleteLibrarian.isPending}
          error={deleteError}
          onConfirm={handleConfirmDeleteLibrarian}
          onClose={() => setDeletingLibrarian(null)}
        />
      )}
    </div>
  );
}
