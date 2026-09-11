import { useMemo, useState } from "react";
import {
  BookOpen,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  Minus,
  PaperPlaneTilt,
  Plus,
  Stack,
  X,
  XCircle,
} from "@phosphor-icons/react";

import { useAllBooks } from "../../hooks/useBooks";
import { useCreateBorrowRequest } from "../../hooks/useLoanRequests";
import { useMe } from "../../hooks/useMe";
import { BookCard } from "../../components/books/BookCard";
import { BookCover } from "../../components/books/BookCover";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import { Skeleton } from "../../components/Skeleton";
import { StatTile } from "../../components/StatTile";
import { ApiError } from "../../services/apiClient";
import type { Book } from "../../types/book";

const PAGE_SIZE = 10;
const SELECT_CLASS =
  "rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none";
const LOAN_PERIOD_OPTIONS = [7, 14, 21, 30] as const;

interface CartLine {
  book: Book;
  quantity: number;
}

export function SearchPage() {
  const { data: books, isLoading } = useAllBooks();
  const { data: me } = useMe();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"" | "in-stock" | "out">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loanPeriodDays, setLoanPeriodDays] = useState<number>(14);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRequest = useCreateBorrowRequest();
  const cardLocked = me?.library_card?.status === "locked";

  usePageHeader({ title: "Tra cứu sách", subtitle: "Tìm sách và gửi yêu cầu mượn tới thủ thư" });

  const stats = useMemo(() => {
    const totalTitles = books?.length ?? 0;
    const totalCopies = books?.reduce((sum, b) => sum + b.quantity, 0) ?? 0;
    const outOfStock = books?.filter((b) => b.quantity === 0).length ?? 0;
    const categories = new Set((books ?? []).map((b) => b.category)).size;
    return { totalTitles, totalCopies, outOfStock, categories };
  }, [books]);

  const categories = useMemo(
    () => [...new Set((books ?? []).map((b) => b.category))].sort((a, b) => a.localeCompare(b)),
    [books],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (books ?? []).filter((b) => {
      const matchesQuery =
        !query || b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query);
      const matchesCategory = !categoryFilter || b.category === categoryFilter;
      const matchesAvailability =
        !availabilityFilter ||
        (availabilityFilter === "out" && b.quantity === 0) ||
        (availabilityFilter === "in-stock" && b.quantity > 0);
      return matchesQuery && matchesCategory && matchesAvailability;
    });
  }, [books, search, categoryFilter, availabilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = books?.find((b) => b.id === selectedId) ?? null;
  const hasActiveFilters = search || categoryFilter || availabilityFilter;

  function selectBook(book: Book) {
    setSelectedId(book.id === selectedId ? null : book.id);
    setQuantity(1);
  }

  function addToCart() {
    if (!selected) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.book.id === selected.id);
      if (existing) {
        return prev.map((l) => (l.book.id === selected.id ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...prev, { book: selected, quantity }];
    });
    setSelectedId(null);
    setQuantity(1);
  }

  function removeFromCart(bookId: string) {
    setCart((prev) => prev.filter((l) => l.book.id !== bookId));
  }

  async function handleSubmit() {
    setError(null);
    try {
      await createRequest.mutateAsync({
        items: cart.map((l) => ({ book_id: l.book.id, quantity: l.quantity })),
        loanPeriodDays,
      });
      setCart([]);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thể gửi yêu cầu");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Tổng đầu sách" value={stats.totalTitles} icon={BookOpen} tone="info" />
        <StatTile label="Tổng số bản có sẵn" value={stats.totalCopies} icon={Stack} tone="success" />
        <StatTile label="Hết hàng" value={stats.outOfStock} icon={XCircle} tone="warning" />
        <StatTile label="Thể loại" value={stats.categories} icon={BookmarkSimple} tone="pending" />
      </div>

      {cardLocked && (
        <p className="rounded-xl bg-danger px-4 py-2.5 text-sm text-danger-foreground">
          Thẻ thư viện của bạn đang bị khóa — bạn không thể gửi yêu cầu mượn sách lúc này.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 lg:col-span-3">
          <p className="mb-3 font-heading text-sm font-semibold">Kho sách</p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên sách, tác giả…"
              className="min-w-[200px] flex-1 rounded-full border border-border bg-background px-4 py-1.5 text-sm outline-none focus:border-accent"
              aria-label="Tìm sách"
            />
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
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
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
              <option value="in-stock">Còn sách</option>
              <option value="out">Hết sách</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                  setAvailabilityFilter("");
                  setPage(1);
                }}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                <XCircle size={14} aria-hidden="true" /> Xoá lọc
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length.toLocaleString("vi-VN")} kết quả
            </span>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <XCircle size={28} className="text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Không tìm thấy sách phù hợp.</p>
            </div>
          )}
          {!isLoading && paginated.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {paginated.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  selected={book.id === selectedId}
                  onSelect={() => selectBook(book)}
                  compact
                />
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
              >
                <CaretLeft size={14} aria-hidden="true" />
              </button>
              <span className="text-sm text-muted-foreground">
                Trang {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Trang sau"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
              >
                <CaretRight size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-1">
          {selected ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm animate-fade-in">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
                <BookCover src={selected.cover_image_url} title={selected.title} />
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Đóng chi tiết"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-10">
                  <span className="mb-1.5 inline-block rounded-full border border-white/40 px-2 py-0.5 text-xs text-white">
                    {selected.category}
                  </span>
                  <p className="font-heading text-lg font-semibold leading-tight text-white">{selected.title}</p>
                  <p className="text-sm text-white/80">{selected.author}</p>
                </div>
              </div>
              <div className="px-2 pb-1 pt-3">
                <dl className="flex flex-col gap-2.5 text-sm">
                  {[
                    ["Mã sách", selected.code],
                    ["Nhà xuất bản", selected.publisher],
                    [
                      "Trạng thái",
                      selected.quantity > 0 ? (
                        <span className="rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
                          Còn {selected.quantity} bản
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

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 font-mono text-sm">
                    <button
                      type="button"
                      aria-label="Giảm số lượng"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      <Minus size={12} aria-hidden="true" />
                    </button>
                    {quantity}
                    <button
                      type="button"
                      aria-label="Tăng số lượng"
                      onClick={() => setQuantity((q) => Math.min(selected.quantity, q + 1))}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      <Plus size={12} aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={cardLocked || selected.quantity === 0}
                    onClick={addToCart}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                  >
                    <Plus size={15} aria-hidden="true" /> Thêm vào yêu cầu
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Chọn một cuốn sách để xem chi tiết.
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info text-info-foreground">
                <PaperPlaneTilt size={16} aria-hidden="true" />
              </span>
              <p className="font-heading text-sm font-semibold">Yêu cầu mượn của bạn</p>
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chọn sách bên trái rồi bấm "Thêm vào yêu cầu".</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map((line) => (
                  <li
                    key={line.book.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                  >
                    <div className="h-9 w-6 flex-none overflow-hidden rounded">
                      <BookCover src={line.book.cover_image_url} title={line.book.title} />
                    </div>
                    <span className="min-w-0 flex-1 truncate">
                      {line.book.title} <span className="text-muted-foreground">× {line.quantity}</span>
                    </span>
                    <button
                      type="button"
                      aria-label="Xoá khỏi yêu cầu"
                      onClick={() => removeFromCart(line.book.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="mt-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              Thời hạn mượn
              <select
                value={loanPeriodDays}
                onChange={(e) => setLoanPeriodDays(Number(e.target.value))}
                aria-label="Thời hạn mượn"
                className={SELECT_CLASS}
              >
                {LOAN_PERIOD_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} ngày
                  </option>
                ))}
              </select>
            </label>

            {sent && <p className="mt-3 text-sm text-success-foreground">Đã gửi yêu cầu — chờ Thủ thư duyệt.</p>}
            {error && <p className="mt-3 text-sm text-danger-foreground">{error}</p>}

            <button
              type="button"
              disabled={cart.length === 0 || cardLocked || createRequest.isPending}
              onClick={handleSubmit}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              {createRequest.isPending ? "Đang gửi…" : "Gửi yêu cầu mượn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
