import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";

import { useBookSearch } from "../../hooks/useBooks";
import { useCreateLoan } from "../../hooks/useLoans";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
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

function BookLineInput({ line, onChange }: { line: LoanLine; onChange: (line: LoanLine) => void }) {
  const debouncedQuery = useDebouncedValue(line.query, 300);
  const { data: options } = useBookSearch(line.book ? "" : debouncedQuery);

  if (line.book) {
    return (
      <div className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
        {line.book.title} <span className="text-muted-foreground">— còn {line.book.quantity}</span>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <input
        value={line.query}
        onChange={(e) => onChange({ ...line, query: e.target.value })}
        placeholder="Tìm sách để thêm vào phiếu…"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        aria-label="Tìm sách"
      />
      {line.query && options && options.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-sm">
          {options.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onChange({ ...line, book, query: "", error: null })}
              >
                {book.title} <span className="text-muted-foreground">— còn {book.quantity}</span>
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
    <div className="rounded-md border border-border bg-card p-4">
      <p className="mb-3 text-sm font-medium text-muted-foreground">Lập phiếu mượn mới</p>

      {disabled && (
        <p className="mb-3 rounded-md bg-danger px-3 py-2 text-sm text-danger-foreground">
          Thẻ thư viện của độc giả này đang bị khóa — không thể lập phiếu mượn.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.key}>
            <div className="flex items-center gap-2">
              <BookLineInput line={line} onChange={(next) => updateLine(line.key, next)} />
              <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-sm">
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  className="w-4 cursor-pointer text-muted-foreground"
                  onClick={() => updateLine(line.key, { ...line, quantity: Math.max(1, line.quantity - 1) })}
                >
                  −
                </button>
                {line.quantity}
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  className="w-4 cursor-pointer text-muted-foreground"
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
            {line.error && <p className="mt-1 text-sm text-danger-foreground">{line.error}</p>}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLines((prev) => [...prev, newLine()])}
        className="mt-3 flex items-center gap-1 text-sm text-accent"
      >
        <Plus size={16} aria-hidden="true" /> Thêm sách
      </button>

      {formError && <p className="mt-3 text-sm text-danger-foreground">{formError}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={disabled || createLoan.isPending}
          onClick={handleSubmit}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {createLoan.isPending ? "Đang xác nhận…" : "Xác nhận lập phiếu"}
        </button>
      </div>
    </div>
  );
}
