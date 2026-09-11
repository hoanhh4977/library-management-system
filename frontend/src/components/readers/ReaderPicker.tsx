import { useMemo, useState } from "react";
import { MagnifyingGlass, ArrowsClockwise } from "@phosphor-icons/react";

import { useAllReaders, useReaderSearch } from "../../hooks/useReaders";
import { StatusBadge } from "../StatusBadge";
import { Avatar } from "../Avatar";
import type { Reader } from "../../types/reader";

/** Search-and-pick a Reader by name/code/email — used at the Librarian counter.
 * Shows a browsable default list (all readers, A→Z) before anything is typed,
 * so the panel isn't just a blank box waiting for input. */
export function ReaderPicker({
  selected,
  onSelect,
}: {
  selected: Reader | null;
  onSelect: (reader: Reader) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: results, isFetching } = useReaderSearch(query);
  const { data: allReaders } = useAllReaders();

  const defaultList = useMemo(
    () => [...(allReaders ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [allReaders],
  );
  const list = (query ? results : defaultList) ?? [];

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar name={selected.full_name} />
          <div>
            <p className="text-sm font-semibold">{selected.full_name}</p>
            <p className="font-mono text-xs text-muted-foreground">{selected.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selected.library_card ? (
            <StatusBadge status={selected.library_card.status} />
          ) : (
            <span className="text-xs text-muted-foreground">Chưa có thẻ thư viện</span>
          )}
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => onSelect(null as never)}
          >
            <ArrowsClockwise size={13} aria-hidden="true" /> Đổi độc giả
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm">
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
      {!query && (
        <p className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground">Tất cả độc giả</p>
      )}
      <ul className="mt-2 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {query && isFetching && <li className="text-sm text-muted-foreground">Đang tìm…</li>}
        {query && !isFetching && results?.length === 0 && (
          <li className="text-sm text-muted-foreground">Không tìm thấy độc giả.</li>
        )}
        {!query && list.length === 0 && (
          <li className="text-sm text-muted-foreground">Chưa có độc giả nào.</li>
        )}
        {(query ? !isFetching : true) &&
          list.map((reader) => (
            <li key={reader.id}>
              <button
                type="button"
                onClick={() => onSelect(reader)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-accent hover:bg-muted"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={reader.full_name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{reader.full_name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{reader.code}</span>
                  </span>
                </span>
                {reader.library_card ? (
                  <StatusBadge status={reader.library_card.status} />
                ) : (
                  <span className="flex-none text-xs text-muted-foreground">Chưa có thẻ</span>
                )}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
