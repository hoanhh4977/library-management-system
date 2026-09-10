import { useMemo, useState, type FormEvent } from "react";
import { NavLink } from "react-router-dom";
import { Plus, PencilSimple, Warning, X, XCircle } from "@phosphor-icons/react";

import { useAllBooks } from "../../hooks/useBooks";
import { useCreateBook, useUpdateBook, type BookInput } from "../../hooks/useBookAdmin";
import { usePendingLoanRequests } from "../../hooks/useLoanRequests";
import { BookCard } from "../../components/books/BookCard";
import { BookCover } from "../../components/books/BookCover";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import type { Book } from "../../types/book";

const LOW_STOCK_THRESHOLD = 3;
const emptyForm: BookInput = { title: "", author: "", publisher: "", category: "", quantity: 0, cover_image_url: "" };

function BookFormDialog({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const [form, setForm] = useState<BookInput>(
    book
      ? {
          title: book.title,
          author: book.author,
          publisher: book.publisher,
          category: book.category,
          quantity: book.quantity,
          cover_image_url: book.cover_image_url ?? "",
        }
      : emptyForm,
  );
  const createBook = useCreateBook();
  const updateBook = useUpdateBook();
  const isPending = createBook.isPending || updateBook.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
          {(["title", "author", "publisher", "category"] as const).map((field) => (
            <label key={field} className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                {{ title: "Tên sách", author: "Tác giả", publisher: "Nhà xuất bản", category: "Thể loại" }[field]}
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

/** Slide-in detail panel for the selected book — ref: Bookary book detail card
 * (cover, genre pill, then Book ID / Publisher / Status label-value rows). */
function BookDetailPanel({ book, onEdit, onClose }: { book: Book; onEdit: () => void; onClose: () => void }) {
  return (
    <div className="flex h-fit flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="aspect-[2/3] w-full max-w-[200px] overflow-hidden rounded-xl">
          <BookCover src={book.cover_image_url} title={book.title} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <p className="font-heading text-lg font-semibold">{book.title}</p>
          <span className="flex-none rounded-full border border-border px-2 py-0.5 text-xs">{book.category}</span>
        </div>
        <p className="text-sm text-muted-foreground">Tác giả {book.author}</p>
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        {[
          ["Mã sách", book.code],
          ["Nhà xuất bản", book.publisher],
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

      <button
        type="button"
        onClick={onEdit}
        className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        <PencilSimple size={15} aria-hidden="true" /> Sửa thông tin
      </button>
    </div>
  );
}

export function BooksPage() {
  const { data: books } = useAllBooks();
  const { data: pendingRequests } = usePendingLoanRequests();
  const [editing, setEditing] = useState<Book | null | "new">(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  usePageHeader({
    title: "Quản lý Sách",
    subtitle: "Thêm, cập nhật và theo dõi kho sách của thư viện",
    search: { value: search, onChange: setSearch, placeholder: "Tìm theo tên sách, tác giả…" },
    action: (
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        <Plus size={16} aria-hidden="true" /> Thêm sách
      </button>
    ),
  });

  const stats = useMemo(() => {
    const availableCopies = books?.reduce((sum, b) => sum + b.quantity, 0) ?? 0;
    const lowStock = books?.filter((b) => b.quantity > 0 && b.quantity <= LOW_STOCK_THRESHOLD).length ?? 0;
    const outOfStock = books?.filter((b) => b.quantity === 0).length ?? 0;
    const pendingBorrowRequests = pendingRequests?.filter((r) => r.kind === "borrow").length ?? 0;
    return { availableCopies, lowStock, outOfStock, pendingBorrowRequests };
  }, [books, pendingRequests]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return books ?? [];
    return (books ?? []).filter(
      (b) => b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query),
    );
  }, [books, search]);

  const selected = books?.find((b) => b.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-mono text-2xl font-bold">{stats.availableCopies}</p>
          <p className="text-xs text-muted-foreground">Tổng số bản còn</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-warning-foreground">
            <Warning size={14} aria-hidden="true" />
            <p className="font-mono text-2xl font-bold">{stats.lowStock}</p>
          </div>
          <p className="text-xs text-muted-foreground">Sắp hết hàng (≤{LOW_STOCK_THRESHOLD} bản)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-1.5 text-danger-foreground">
            <XCircle size={14} aria-hidden="true" />
            <p className="font-mono text-2xl font-bold">{stats.outOfStock}</p>
          </div>
          <p className="text-xs text-muted-foreground">Hết sách</p>
        </div>
        <NavLink
          to="/librarian/requests"
          className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
        >
          <p className="font-mono text-2xl font-bold text-accent">{stats.pendingBorrowRequests}</p>
          <p className="text-xs text-muted-foreground">Yêu cầu mượn đang chờ</p>
        </NavLink>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-3 xl:grid-cols-4">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              selected={book.id === selectedId}
              onSelect={() => setSelectedId(book.id === selectedId ? null : book.id)}
            />
          ))}
          {books && filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Không tìm thấy sách phù hợp.</p>
          )}
        </div>

        <div className="lg:col-span-1">
          {selected ? (
            <BookDetailPanel book={selected} onEdit={() => setEditing(selected)} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Chọn một cuốn sách để xem chi tiết.
            </div>
          )}
        </div>
      </div>

      {editing && <BookFormDialog book={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
