import { useState } from "react";
import { ClipboardText, Plus, X } from "@phosphor-icons/react";

import { useBookSearch } from "../../hooks/useBooks";
import { useCreateLoan } from "../../hooks/useLoans";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { BookCover } from "../books/BookCover";
import type { Book } from "../../types/book";

interface LoanLine {
  key: number;
  book: Book | null;
  quantity: number;
  query: string;
  error: string | null;
}

let lineKeySeq = 0;
const newLine = (): LoanLine => ({ key: lineKeySeq++, book: null, quantity: 1, query: "", error: null });

const LOAN_PERIOD_OPTIONS = [7, 14, 21, 30] as const;

function BookLineInput({
  line,
  onChange,
  disabled,
}: {
  line: LoanLine;
  onChange: (line: LoanLine) => void;
  disabled?: boolean;
}) {
  const debouncedQuery = useDebouncedValue(line.query, 300);
  const { data: options } = useBookSearch(line.book ? "" : debouncedQuery);

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
        placeholder="Tìm sách để thêm vào phiếu…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Tìm sách"
        disabled={disabled}
      />
      {!disabled && line.query && options && options.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card py-1 shadow-lg">
          {options.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onChange({ ...line, book, query: "", error: null })}
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

/** Multi-row "lập phiếu mượn" form — see design-system key-patterns.md §2 for the UX rationale. */
export function NewLoanForm({
  readerId,
  cardStatus,
  onDone,
}: {
  readerId: string;
  cardStatus: "active" | "locked" | undefined;
  onDone: () => void;
}) {
  const [lines, setLines] = useState<LoanLine[]>([newLine()]);
  const [loanPeriodDays, setLoanPeriodDays] = useState<number>(14);
  const [formError, setFormError] = useState<string | null>(null);
  const createLoan = useCreateLoan();

  const disabled = cardStatus !== "active";

  function updateLine(key: number, next: LoanLine) {
    setLines((prev) => prev.map((l) => (l.key === key ? next : l)));
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  async function handleSubmit() {
    setFormError(null);
    const chosen = lines.filter((l) => l.book);
    if (chosen.length === 0) {
      setFormError("Chọn ít nhất một cuốn sách.");
      return;
    }

    const result = await createLoan.mutateAsync({
      reader_id: readerId,
      items: chosen.map((l) => ({ book_id: l.book!.id, quantity: l.quantity })),
      loan_period_days: loanPeriodDays,
    });

    const failed = result.items.filter((i) => !i.ok);
    if (failed.length === 0) {
      onDone();
      return;
    }
    // Partial failure (FR-015): mark only the failing lines, keep the rest so the
    // librarian can fix and resubmit instead of losing everything.
    setLines((prev) =>
      prev.map((line) => {
        const failure = line.book && failed.find((f) => f.book_id === line.book!.id);
        return failure ? { ...line, error: failure.detail } : line;
      }),
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info text-info-foreground">
          <ClipboardText size={16} aria-hidden="true" />
        </span>
        <p className="font-heading text-sm font-semibold">Lập phiếu mượn mới</p>
      </div>

      {disabled && (
        <p className="mb-3 rounded-xl bg-danger px-3 py-2 text-sm text-danger-foreground">
          Thẻ thư viện của độc giả này đang bị khóa — không thể lập phiếu mượn.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.key}>
            <div className="flex items-center gap-2">
              <BookLineInput line={line} onChange={(next) => updateLine(line.key, next)} disabled={disabled} />
              <div className="flex items-center gap-1 rounded-xl border border-border px-2 py-1.5 font-mono text-sm">
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={disabled}
                  className="flex h-6 w-6 items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  onClick={() => updateLine(line.key, { ...line, quantity: Math.max(1, line.quantity - 1) })}
                >
                  −
                </button>
                {line.quantity}
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  disabled={disabled}
                  className="flex h-6 w-6 items-center justify-center rounded-md cursor-pointer text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  onClick={() => updateLine(line.key, { ...line, quantity: line.quantity + 1 })}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                aria-label="Xoá dòng"
                disabled={disabled}
                className="cursor-pointer text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => removeLine(line.key)}
              >
                <X size={16} />
              </button>
            </div>
            {line.error && <p className="mt-1 text-sm text-danger-foreground">{line.error}</p>}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setLines((prev) => [...prev, newLine()])}
        className="mt-3 flex items-center gap-1 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={16} aria-hidden="true" /> Thêm sách
      </button>

      {formError && <p className="mt-3 text-sm text-danger-foreground">{formError}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Thời hạn mượn
          <select
            value={loanPeriodDays}
            onChange={(e) => setLoanPeriodDays(Number(e.target.value))}
            disabled={disabled}
            aria-label="Thời hạn mượn"
            className="rounded-full border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {LOAN_PERIOD_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} ngày
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={disabled || createLoan.isPending}
          onClick={handleSubmit}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {createLoan.isPending ? "Đang xác nhận…" : "Xác nhận lập phiếu"}
        </button>
      </div>
    </div>
  );
}
