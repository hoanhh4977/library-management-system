import { useCallback, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, CircleNotch, Copy, Lock, LockOpen, PencilSimple, UserCircle, UserPlus, UsersThree } from "@phosphor-icons/react";

import {
  useAllReaders,
  useAllLibrarians,
  useUpdateReader,
  useUpdateLibrarian,
  useCreateLibrarian,
} from "../../hooks/useReaders";
import { StatusBadge } from "../../components/StatusBadge";
import { StatTile } from "../../components/StatTile";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { ApiError } from "../../services/apiClient";
import { bucketByDay, weekOverWeekLevel } from "../../lib/trend";

function AddLibrarianDialog({ onClose }: { onClose: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createLibrarian = useCreateLibrarian();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createLibrarian.mutateAsync({ full_name: fullName, email, date_of_birth: dateOfBirth });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo tài khoản nhân viên.");
    }
  }

  const result = createLibrarian.data;

  if (result) {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg">
          <h2 className="mb-1 font-heading text-lg font-semibold">Đã tạo tài khoản</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Gửi mật khẩu tạm thời này cho <strong className="text-foreground">{result.librarian.full_name}</strong> —
            họ nên đổi mật khẩu qua "Quên mật khẩu" ngay lần đăng nhập đầu tiên.
          </p>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <code className="flex-1 truncate text-sm">{result.temporary_password}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(result.temporary_password);
                setCopied(true);
              }}
              aria-label="Sao chép mật khẩu"
              className="flex-none rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            Xong
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg">
        <h2 className="mb-4 font-heading text-lg font-semibold">Thêm Nhân viên thủ thư</h2>
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Họ tên</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Ngày sinh</span>
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-foreground">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Hủy
          </button>
          <button
            type="submit"
            disabled={createLibrarian.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {createLibrarian.isPending ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Click-to-edit table cell — ref: Supabase's table editor (click a cell, it
 * expands into an input; Enter commits, Esc reverts) — replaces the old "Sửa"
 * popup for single-field edits so changing one thing doesn't need a whole dialog.
 * Blur also commits (matches spreadsheet-style editors: clicking away saves,
 * only Esc discards) — `skipBlurCommit` guards the one case where that would be
 * wrong: Esc sets editing=false, which can unmount/blur the input natively before
 * React's state update lands, so the ref tells the resulting blur to no-op instead
 * of re-committing a draft that was just explicitly discarded. */
function EditableCell({
  value,
  onSave,
  placeholder,
  type = "text",
  valueClassName = "",
}: {
  value: string;
  onSave: (next: string) => Promise<unknown>;
  placeholder?: string;
  type?: "text" | "tel";
  valueClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipBlurCommit = useRef(false);

  function startEdit() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  async function commit(next: string) {
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thể lưu");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    skipBlurCommit.current = true;
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  function handleBlur() {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    void commit(draft);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted"
      >
        <span className={`min-w-0 flex-1 truncate ${valueClassName}`}>
          {value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>}
        </span>
        <PencilSimple
          size={12}
          className="flex-none text-muted-foreground opacity-0 group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type={type}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full rounded-md border border-accent bg-background px-1.5 py-1 text-sm outline-none disabled:opacity-60"
        />
        {saving && <CircleNotch size={14} className="flex-none animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      {error ? (
        <span className="text-[11px] text-danger-foreground">{error}</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">Enter để lưu · Esc để hủy</span>
      )}
    </div>
  );
}

export function PeoplePage() {
  const [tab, setTab] = useState<"readers" | "librarians">("readers");
  const { data: readers } = useAllReaders();
  const { data: librarians } = useAllLibrarians();
  const updateReader = useUpdateReader();
  const updateLibrarian = useUpdateLibrarian();
  const [addingLibrarian, setAddingLibrarian] = useState(false);
  const [search, setSearch] = useState("");
  const [cardStatusFilter, setCardStatusFilter] = useState<"" | "active" | "locked">("");

  const handleSearchChange = useCallback((v: string) => setSearch(v), []);
  const headerAction = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setAddingLibrarian(true)}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        <UserPlus size={16} aria-hidden="true" /> Thêm nhân viên
      </button>
    ),
    [],
  );

  usePageHeader({
    title: "Độc giả & Nhân viên",
    subtitle: "Quản lý hồ sơ độc giả và nhân viên thủ thư",
    search: { value: search, onChange: handleSearchChange, placeholder: "Tìm theo tên, mã, email…" },
    action: headerAction,
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
              </tr>
            </thead>
            <tbody>
              {!readers &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {readers && filteredReaders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
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
              </tr>
            </thead>
            <tbody>
              {!librarians &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3" colSpan={2}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {librarians && filteredLibrarians.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-muted-foreground">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addingLibrarian && <AddLibrarianDialog onClose={() => setAddingLibrarian(false)} />}
    </div>
  );
}
