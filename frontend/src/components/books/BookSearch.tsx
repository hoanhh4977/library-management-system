import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { useBookSearch } from "../../hooks/useBooks";
import { BookCard } from "./BookCard";

/** Shared tra-cứu-sách UI (FR-003): cover grid, reused by Reader search and Librarian
 * lookup. Ref: "Books Collection" grid — covers carry the visual weight, not rows of text. */
export function BookSearch() {
  const [query, setQuery] = useState("");
  const { data: books, isFetching } = useBookSearch(query);

  return (
    <div>
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
        <MagnifyingGlass size={18} className="text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên sách, tác giả hoặc thể loại…"
          className="w-full bg-transparent text-sm outline-none"
          aria-label="Tra cứu sách"
        />
      </label>

      {isFetching && <p className="mt-4 text-sm text-muted-foreground">Đang tìm…</p>}
      {!isFetching && query && books?.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Không tìm thấy kết quả.</p>
      )}

      {books && books.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
