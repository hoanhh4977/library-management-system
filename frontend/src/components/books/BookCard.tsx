import type { ReactNode } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";

import { BookCover } from "./BookCover";
import type { Book } from "../../types/book";

interface BookCardProps {
  book: Book;
  footer?: ReactNode;
  /** Selected state — solid accent card + white arrow chip, ref: "Books Collection" grid. */
  selected?: boolean;
  onSelect?: () => void;
}

/** Cover-forward grid card (ref: "Books Collection" grid) — reused by Reader search
 * results and Admin book management. `footer` lets each page add its own action;
 * pass `onSelect` to make the whole card clickable (drives a detail panel). */
export function BookCard({ book, footer, selected, onSelect }: BookCardProps) {
  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={`flex w-full flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-colors ${
        selected ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card hover:shadow-md"
      }`}
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-muted">
        <BookCover src={book.cover_image_url} title={book.title} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
        <p className={`text-xs ${selected ? "text-accent-foreground/80" : "text-muted-foreground"}`}>{book.author}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs">
          <span
            className={
              selected
                ? "text-accent-foreground/80"
                : book.quantity > 0
                  ? "text-success-foreground"
                  : "text-danger-foreground"
            }
          >
            {book.quantity > 0 ? `Còn ${book.quantity}` : "Hết sách"}
          </span>
          {onSelect ? (
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                selected ? "bg-white/20" : "bg-muted"
              }`}
            >
              <ArrowUpRight size={13} aria-hidden="true" />
            </span>
          ) : (
            footer
          )}
        </div>
      </div>
    </Wrapper>
  );
}
