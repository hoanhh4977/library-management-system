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
  /** Denser padding/type scale — used where many cards must fit one screen without
   * scrolling (Admin's "Quản lý Sách" grid); the default size stays for Reader search. */
  compact?: boolean;
}

/** Cover-forward grid card (ref: "Books Collection" grid) — reused by Reader search
 * results and Admin book management. `footer` lets each page add its own action;
 * pass `onSelect` to make the whole card clickable (drives a detail panel). */
export function BookCard({ book, footer, selected, onSelect, compact }: BookCardProps) {
  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      type={onSelect ? "button" : undefined}
      onClick={onSelect}
      className={`group flex w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-all duration-200 ${
        selected
          ? "border-accent bg-accent text-accent-foreground shadow-lg"
          : "border-border bg-card hover:-translate-y-0.5 hover:shadow-lg"
      }`}
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-muted">
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          <BookCover src={book.cover_image_url} title={book.title} />
        </div>
      </div>
      <div className={`flex flex-1 flex-col gap-1 ${compact ? "p-2" : "p-3.5"}`}>
        <p className={`line-clamp-2 font-medium leading-snug ${compact ? "text-xs" : "text-sm"}`}>{book.title}</p>
        {!compact && (
          <p className={`text-xs ${selected ? "text-accent-foreground/80" : "text-muted-foreground"}`}>
            {book.author}
          </p>
        )}
        <div className={`mt-auto flex items-center justify-between text-xs ${compact ? "pt-1" : "pt-2"}`}>
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
              className={`flex items-center justify-center rounded-full ${compact ? "h-5 w-5" : "h-6 w-6"} ${
                selected ? "bg-white/20" : "bg-muted"
              }`}
            >
              <ArrowUpRight size={compact ? 11 : 13} aria-hidden="true" />
            </span>
          ) : (
            footer
          )}
        </div>
      </div>
    </Wrapper>
  );
}
