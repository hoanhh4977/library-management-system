import { useCallback, useMemo, useState, type FormEvent } from "react";
import { NavLink } from "react-router-dom";
import {
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  Plus,
  PencilSimple,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react";

import { useAllBooks } from "../../hooks/useBooks";
import { useCreateBook, useUpdateBook, type BookInput } from "../../hooks/useBookAdmin";
import { useMe } from "../../hooks/useMe";
import { usePendingLoanRequests } from "../../hooks/useLoanRequests";
import { useActivityLog, useInventoryReport, useOverdueReport } from "../../hooks/useReports";
import type { ActivityItem } from "../../hooks/useReports";
import { BookCard } from "../../components/books/BookCard";
import { BookCover } from "../../components/books/BookCover";
import { LoanDetailModal } from "../../components/loans/LoanDetailModal";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import type { Book } from "../../types/book";

const LOW_STOCK_THRESHOLD = 3;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30];
const SELECT_CLASS =
  "rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none";
const emptyForm: BookInput = { title: "", author: "", publisher: "", categories: [], quantity: 0, cover_image_url: "" };

function CategoryTagInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function addCategory() {
    const name = draft.trim();
    if (!name || value.includes(name)) {
      setDraft("");
      return;
    }
    onChange([...value, name]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
      {value.map((name) => (
        <span key={name} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          {name}
          <button
            type="button"
            aria-label={`Xoá thể loại ${name}`}
            onClick={() => onChange(value.filter((c) => c !== name))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={10} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addCategory();
          }
        }}
        onBlur={addCategory}
        placeholder={value.length === 0 ? "Nhập thể loại, Enter để thêm…" : "Thêm…"}
        className="min-w-[100px] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function BookFormDialog({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const [form, setForm] = useState<BookInput>(
    book
      ? {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          categories: book.categories,
          quantity: book.quantity,
          cover_image_url: book.cover_image_url ?? "",
        }
      : emptyForm,
  );
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const createBook = useCreateBook();
  const updateBook = useUpdateBook();
  const isPending = createBook.isPending || updateBook.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.categories.length === 0) {
      setCategoryError("Cần thêm ít nhất một thể loại.");
      return;
    }
    setCategoryError(null);
    const payload = { ...form, cover_image_url: form.cover_image_url || null };
    if (book) {
      await updateBook.mutateAsync({ bookId: book.id, ...payload });
    } else {
      await createBook.mutateAsync(payload);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg">
        <h2 className="mb-4 font-heading text-lg font-semibold">
          {book ? "Cập nhật thông tin Sách" : "Thêm Sách mới"}
        </h2>
        <div className="flex flex-col gap-3">
          {(["title", "author", "publisher"] as const).map((field) => (
            <label key={field} className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                {{ title: "Tên sách", author: "Tác giả", publisher: "Nhà xuất bản" }[field]}
              </span>
              <input
                required
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Thể loại</span>
            <CategoryTagInput
              value={form.categories}
              onChange={(categories) => {
                setForm({ ...form, categories });
                setCategoryError(null);
              }}
            />
            {categoryError && <p className="mt-1 text-xs text-danger-foreground">{categoryError}</p>}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Số lượng</span>
            <input
              type="number"
              min={0}
              required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">URL ảnh bìa (tuỳ chọn)</span>
            <input
              type="url"
              value={form.cover_image_url ?? ""}
              onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
              placeholder="https://…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Hủy
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {isPending ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Hero detail panel for the selected book — ref: Bookary book detail card: a
 * large poster-style cover with the title overlaid on a bottom scrim, then
 * Book ID / Publisher / Lượt mượn / Status label-value rows below it. */
function BookDetailPanel({
  book,
  borrowedCount,
  borrowers,
  onEdit,
  onClose,
  onViewLoan,
}: {
  book: Book;
  borrowedCount: number;
  borrowers: ActivityItem[];
  onEdit: () => void;
  onClose: () => void;
  onViewLoan: (loanId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm animate-fade-in">
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-muted">
        <BookCover src={book.cover_image_url} title={book.title} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
        >
          <X size={16} aria-hidden="true" />
        </button>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-10">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {book.categories.map((name) => (
              <span
                key={name}
                className="inline-block rounded-full border border-white/40 px-2 py-0.5 text-xs text-white"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="font-heading text-lg font-semibold leading-tight text-white">{book.title}</p>
          <p className="text-sm text-white/80">{book.author}</p>
        </div>
      </div>

      <div className="px-2 pb-1 pt-3">
        <dl className="flex flex-col gap-2.5 text-sm">
          {[
            ["Mã sách", book.code],
            ["Nhà xuất bản", book.publisher],
            ["Lượt mượn", borrowedCount.toLocaleString("vi-VN")],
            [
              "Trạng thái",
              book.quantity > 0 ? (
                <span className="rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
                  Còn {book.quantity} bản
                </span>
              ) : (
                <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-medium text-danger-foreground">
                  Hết sách
                </span>
              ),
            ],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {borrowers.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Đang được mượn ({borrowers.length})
            </p>
            <ul className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
              {borrowers.map((b) => (
                <li key={`${b.loan_id}-${b.book_id}`}>
                  <button
                    type="button"
                    onClick={() => onViewLoan(b.loan_id)}
                    className="flex w-full items-center justify-between text-left text-sm text-accent hover:underline"
                  >
                    <span className="min-w-0 truncate">{b.reader_name}</span>
                    <span className="flex-none font-mono text-xs text-muted-foreground">Hẹn {b.due_date}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onEdit}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        >
          <PencilSimple size={15} aria-hidden="true" /> Sửa thông tin
        </button>
      </div>
    </div>
  );
}

export function BooksPage() {
  const { data: me } = useMe();
  const isLibrarian = me?.role === "librarian";
  const { data: books } = useAllBooks();
  // Loan-request review is Librarian-only now — Admin visiting the shared /admin/books
  // route skips this query entirely rather than firing a 403.
  const { data: pendingRequests } = usePendingLoanRequests(isLibrarian);
  const { data: overdue } = useOverdueReport();
  const { data: inventory } = useInventoryReport();
  const { data: activityLog } = useActivityLog();
  const [editing, setEditing] = useState<Book | null | "new">(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewLoanId, setViewLoanId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"" | "in-stock" | "low" | "out">("");
  const [sortBy, setSortBy] = useState<"default" | "popular">("default");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const headerAction = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        <Plus size={16} aria-hidden="true" /> Thêm sách
      </button>
    ),
    [],
  );

  usePageHeader({
    title: "Quản lý Sách",
    subtitle: "Thêm, cập nhật và theo dõi kho sách của thư viện",
    search: {
      value: search,
      onChange: handleSearchChange,
      placeholder: "Tìm theo tên sách, tác giả…",
    },
    action: headerAction,
  });

  const stats = useMemo(() => {
    const availableCopies = books?.reduce((sum, b) => sum + b.quantity, 0) ?? 0;
    const lowStock = books?.filter((b) => b.quantity > 0 && b.quantity <= LOW_STOCK_THRESHOLD).length ?? 0;
    const outOfStock = books?.filter((b) => b.quantity === 0).length ?? 0;
    const pendingBorrowRequests = pendingRequests?.filter((r) => r.kind === "borrow").length ?? 0;
    return { availableCopies, lowStock, outOfStock, pendingBorrowRequests, overdue: overdue?.items.length ?? 0 };
  }, [books, pendingRequests, overdue]);

  const categories = useMemo(
    () => [...new Set((books ?? []).flatMap((b) => b.categories))].sort((a, b) => a.localeCompare(b)),
    [books],
  );

  const borrowingByBook = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of inventory?.books ?? []) map.set(b.book_id, b.borrowing);
    return map;
  }, [inventory]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = (books ?? []).filter((b) => {
      const matchesQuery = !query || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query);
      const matchesCategory = !categoryFilter || b.categories.includes(categoryFilter);
      const matchesAvailability =
        !availabilityFilter ||
        (availabilityFilter === "out" && b.quantity === 0) ||
        (availabilityFilter === "low" && b.quantity > 0 && b.quantity <= LOW_STOCK_THRESHOLD) ||
        (availabilityFilter === "in-stock" && b.quantity > LOW_STOCK_THRESHOLD);
      return matchesQuery && matchesCategory && matchesAvailability;
    });
    if (sortBy === "popular") {
      return [...rows].sort((a, b) => (borrowingByBook.get(b.id) ?? 0) - (borrowingByBook.get(a.id) ?? 0));
    }
    return rows;
  }, [books, search, categoryFilter, availabilityFilter, sortBy, borrowingByBook]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selected = books?.find((b) => b.id === selectedId) ?? null;
  const selectedBorrowedCount = useMemo(
    () => (selected ? (activityLog?.items.filter((i) => i.book_id === selected.id).length ?? 0) : 0),
    [activityLog, selected],
  );
  // Real-time — who currently holds a copy, not just a historical tally — so staff
  // can answer "who has this book right now" without cross-referencing loan records.
  const selectedBorrowers = useMemo(
    () =>
      selected
        ? (activityLog?.items.filter((i) => i.book_id === selected.id && i.status === "borrowing") ?? [])
        : [],
    [activityLog, selected],
  );

  return (
    <div className="flex h-full flex-col gap-4 animate-fade-in">
      <div className={`grid flex-none grid-cols-2 gap-3 ${isLibrarian ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-info/50 p-4">
          <p className="font-mono text-2xl font-bold">{stats.availableCopies}</p>
          <p className="text-xs text-muted-foreground">Tổng số bản còn</p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-warning/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-warning-foreground">
            <Warning size={14} aria-hidden="true" />
            <p className="font-mono text-2xl font-bold">{stats.lowStock}</p>
          </div>
          <p className="text-xs text-muted-foreground">Sắp hết hàng (≤{LOW_STOCK_THRESHOLD} bản)</p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-danger/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-danger-foreground">
            <XCircle size={14} aria-hidden="true" />
            <p className="font-mono text-2xl font-bold">{stats.outOfStock}</p>
          </div>
          <p className="text-xs text-muted-foreground">Hết sách</p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-danger/50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-danger-foreground">
            <ClockCounterClockwise size={14} aria-hidden="true" />
            <p className="font-mono text-2xl font-bold">{stats.overdue}</p>
          </div>
          <p className="text-xs text-muted-foreground">Sách quá hạn trả</p>
        </div>
        {isLibrarian && (
          <NavLink
            to="/librarian/requests"
            className="rounded-2xl border border-border bg-gradient-to-br from-card to-pending/50 p-4 transition-colors hover:brightness-95"
          >
            <p className="font-mono text-2xl font-bold text-accent">{stats.pendingBorrowRequests}</p>
            <p className="text-xs text-muted-foreground">Yêu cầu mượn đang chờ</p>
          </NavLink>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 flex-none font-heading text-sm font-semibold">Kho sách</p>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-4">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 lg:col-span-3">
      <div className="mb-3 flex flex-none flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => {
              setSortBy("default");
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              sortBy === "default" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => {
              setSortBy("popular");
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              sortBy === "popular" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"
            }`}
          >
            Mượn nhiều nhất
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className={SELECT_CLASS}
            aria-label="Lọc theo thể loại"
          >
            <option value="">Tất cả thể loại</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={availabilityFilter}
            onChange={(e) => {
              setAvailabilityFilter(e.target.value as typeof availabilityFilter);
              setPage(1);
            }}
            className={SELECT_CLASS}
            aria-label="Lọc theo tình trạng"
          >
            <option value="">Tất cả tình trạng</option>
            <option value="in-stock">Còn nhiều</option>
            <option value="low">Sắp hết</option>
            <option value="out">Hết hàng</option>
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          {!books &&
            Array.from({ length: pageSize }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
            ))}
          {paginated.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              selected={book.id === selectedId}
              onSelect={() => setSelectedId(book.id === selectedId ? null : book.id)}
              compact
            />
          ))}
          {books && filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Không tìm thấy sách phù hợp.</p>
          )}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="mt-3 flex flex-none flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <p>
              Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} trên{" "}
              {filtered.length} kết quả
            </p>
            <label className="flex items-center gap-1.5">
              <span>Mỗi trang</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-full border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none"
                aria-label="Số sách mỗi trang"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Trang trước"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
            >
              <CaretLeft size={14} aria-hidden="true" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === currentPage ? "page" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  n === currentPage
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Trang sau"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
            >
              <CaretRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      </div>

        <div className="min-h-0 lg:col-span-1">
          {selected ? (
            <BookDetailPanel
              book={selected}
              borrowedCount={selectedBorrowedCount}
              borrowers={selectedBorrowers}
              onEdit={() => setEditing(selected)}
              onClose={() => setSelectedId(null)}
              onViewLoan={setViewLoanId}
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Chọn một cuốn sách để xem chi tiết.
            </div>
          )}
        </div>
      </div>
      </div>

      {editing && <BookFormDialog book={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {viewLoanId && <LoanDetailModal loanId={viewLoanId} onClose={() => setViewLoanId(null)} />}
    </div>
  );
}
