import { useRef, useState, type KeyboardEvent } from "react";
import { CircleNotch, PencilSimple } from "@phosphor-icons/react";

import { ApiError } from "../services/apiClient";

/** Click-to-edit table cell — ref: Supabase's table editor (click a cell, it
 * expands into an input; Enter commits, Esc reverts) — replaces a "Sửa" popup
 * for single-field edits so changing one thing doesn't need a whole dialog.
 * Blur also commits (matches spreadsheet-style editors: clicking away saves,
 * only Esc discards) — `skipBlurCommit` guards the one case where that would be
 * wrong: Esc sets editing=false, which can unmount/blur the input natively before
 * React's state update lands, so the ref tells the resulting blur to no-op instead
 * of re-committing a draft that was just explicitly discarded. */
export function EditableCell({
  value,
  onSave,
  placeholder,
  type = "text",
  valueClassName = "",
}: {
  value: string;
  onSave: (next: string) => Promise<unknown>;
  placeholder?: string;
  type?: "text" | "tel";
  valueClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipBlurCommit = useRef(false);

  function startEdit() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  async function commit(next: string) {
    if (next === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không thể lưu");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    skipBlurCommit.current = true;
    setDraft(value);
    setError(null);
    setEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  function handleBlur() {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    void commit(draft);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted"
      >
        <span className={`min-w-0 flex-1 truncate ${valueClassName}`}>
          {value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>}
        </span>
        <PencilSimple
          size={12}
          className="flex-none text-muted-foreground opacity-0 group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type={type}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full rounded-md border border-accent bg-background px-1.5 py-1 text-sm outline-none disabled:opacity-60"
        />
        {saving && <CircleNotch size={14} className="flex-none animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      {error ? (
        <span className="text-[11px] text-danger-foreground">{error}</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">Enter để lưu · Esc để hủy</span>
      )}
    </div>
  );
}
