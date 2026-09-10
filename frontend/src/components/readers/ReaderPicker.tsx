import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

import { useReaderSearch } from "../../hooks/useReaders";
import { StatusBadge } from "../StatusBadge";
import type { Reader } from "../../types/reader";

/** Search-and-pick a Reader by name/code/email — used at the Librarian counter. */
export function ReaderPicker({
  selected,
  onSelect,
}: {
  selected: Reader | null;
  onSelect: (reader: Reader) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: results, isFetching } = useReaderSearch(query);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
        <div>
          <p className="text-sm font-medium">{selected.full_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{selected.code}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.library_card ? (
            <StatusBadge status={selected.library_card.status} />
          ) : (
            <span className="text-xs text-muted-foreground">Chưa có thẻ thư viện</span>
          )}
          <button type="button" className="text-xs text-accent" onClick={() => onSelect(null as never)}>
            Đổi độc giả
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <MagnifyingGlass size={18} className="text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm độc giả theo tên, mã hoặc email…"
          className="w-full bg-transparent text-sm outline-none"
          aria-label="Tìm độc giả"
        />
      </label>
      {query && (
        <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
          {isFetching && <li className="text-sm text-muted-foreground">Đang tìm…</li>}
          {!isFetching && results?.length === 0 && (
            <li className="text-sm text-muted-foreground">Không tìm thấy độc giả.</li>
          )}
          {results?.map((reader) => (
            <li key={reader.id}>
              <button
                type="button"
                onClick={() => onSelect(reader)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>
                  {reader.full_name} <span className="font-mono text-xs text-muted-foreground">{reader.code}</span>
                </span>
                {reader.library_card ? (
                  <StatusBadge status={reader.library_card.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">Chưa có thẻ</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
