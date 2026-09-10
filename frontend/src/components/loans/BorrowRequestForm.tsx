import { useState } from "react";
import { PaperPlaneTilt, Plus, X } from "@phosphor-icons/react";

import { useBookSearch } from "../../hooks/useBooks";
import { useCreateBorrowRequest } from "../../hooks/useLoanRequests";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { BookCover } from "../books/BookCover";
import type { Book } from "../../types/book";

interface Line {
  key: number;
  book: Book | null;
  quantity: number;
  query: string;
}

let seq = 0;
const newLine = (): Line => ({ key: seq++, book: null, quantity: 1, query: "" });

function BookLineInput({ line, onChange }: { line: Line; onChange: (line: Line) => void }) {
  const debounced = useDebouncedValue(line.query, 300);
  const { data: options } = useBookSearch(line.book ? "" : debounced);

  if (line.book) {
    return (
      <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm">
        <div className="h-9 w-6 flex-none overflow-hidden rounded">
          <BookCover src={line.book.cover_image_url} title={line.book.title} />
        </div>
        <span className="min-w-0 truncate">
          {line.book.title} <span className="text-muted-foreground">— còn {line.book.quantity}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <input
        value={line.query}
        onChange={(e) => onChange({ ...line, query: e.target.value })}
        placeholder="Tìm sách muốn mượn…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        aria-label="Tìm sách muốn mượn"
      />
      {line.query && options && options.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card py-1 shadow-lg">
          {options.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onChange({ ...line, book, query: "" })}
              >
                <div className="h-9 w-6 flex-none overflow-hidden rounded">
                  <BookCover src={book.cover_image_url} title={book.title} />
                </div>
                <span className="min-w-0 truncate">
                  {book.title} <span className="text-muted-foreground">— còn {book.quantity}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Độc giả tự chọn sách và gửi yêu cầu mượn — Thủ thư sẽ duyệt/từ chối (không mượn ngay). */
export function BorrowRequestForm() {
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [sent, setSent] = useState(false);
  const createRequest = useCreateBorrowRequest();

  function updateLine(key: number, next: Line) {
    setLines((prev) => prev.map((l) => (l.key === key ? next : l)));
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  async function handleSubmit() {
    const chosen = lines.filter((l) => l.book);
    if (chosen.length === 0) return;
    await createRequest.mutateAsync(chosen.map((l) => ({ book_id: l.book!.id, quantity: l.quantity })));
    setLines([newLine()]);
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info text-info-foreground">
          <PaperPlaneTilt size={16} aria-hidden="true" />
        </span>
        <p className="font-heading text-sm font-semibold">Gửi yêu cầu mượn sách</p>
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.key} className="flex items-center gap-2">
            <BookLineInput line={line} onChange={(next) => updateLine(line.key, next)} />
            <div className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 font-mono text-sm">
              <button
                type="button"
                aria-label="Giảm số lượng"
                className="flex h-6 w-6 items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted"
                onClick={() => updateLine(line.key, { ...line, quantity: Math.max(1, line.quantity - 1) })}
              >
                −
              </button>
              {line.quantity}
              <button
                type="button"
                aria-label="Tăng số lượng"
                className="flex h-6 w-6 items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted"
                onClick={() => updateLine(line.key, { ...line, quantity: line.quantity + 1 })}
              >
                +
              </button>
            </div>
            <button
              type="button"
              aria-label="Xoá dòng"
              className="cursor-pointer text-muted-foreground"
              onClick={() => removeLine(line.key)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, newLine()])}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-accent"
      >
        <Plus size={16} aria-hidden="true" /> Thêm sách
      </button>

      {sent && <p className="mt-3 text-sm text-success-foreground">Đã gửi yêu cầu — chờ Thủ thư duyệt.</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={createRequest.isPending || !lines.some((l) => l.book)}
          onClick={handleSubmit}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {createRequest.isPending ? "Đang gửi…" : "Gửi yêu cầu mượn"}
        </button>
      </div>
    </div>
  );
}
