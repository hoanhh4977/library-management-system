import { useState, type FormEvent } from "react";

import { useAllReaders, useAllLibrarians, useUpdateReader, useUpdateLibrarian } from "../../hooks/useReaders";
import { StatusBadge } from "../../components/StatusBadge";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import type { Librarian, Reader } from "../../types/reader";

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-muted text-xs font-semibold">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function EditReaderDialog({ reader, onClose }: { reader: Reader; onClose: () => void }) {
  const [phone, setPhone] = useState(reader.phone ?? "");
  const updateReader = useUpdateReader();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateReader.mutateAsync({ readerId: reader.id, phone });
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-heading text-lg font-semibold">Cập nhật Độc giả</h2>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Số điện thoại</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
            Hủy
          </button>
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

function EditLibrarianDialog({ librarian, onClose }: { librarian: Librarian; onClose: () => void }) {
  const [fullName, setFullName] = useState(librarian.full_name);
  const updateLibrarian = useUpdateLibrarian();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await updateLibrarian.mutateAsync({ librarianId: librarian.id, full_name: fullName });
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-heading text-lg font-semibold">Cập nhật Nhân viên thủ thư</h2>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Họ tên</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">
            Hủy
          </button>
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}

export function PeoplePage() {
  const [tab, setTab] = useState<"readers" | "librarians">("readers");
  const { data: readers } = useAllReaders();
  const { data: librarians } = useAllLibrarians();
  const [editingReader, setEditingReader] = useState<Reader | null>(null);
  const [editingLibrarian, setEditingLibrarian] = useState<Librarian | null>(null);

  usePageHeader({ title: "Độc giả & Nhân viên", subtitle: "Quản lý hồ sơ độc giả và nhân viên thủ thư" });

  return (
    <div>
      <div className="mb-4 inline-flex gap-1 rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("readers")}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === "readers" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"}`}
        >
          Độc giả
        </button>
        <button
          type="button"
          onClick={() => setTab("librarians")}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === "librarians" ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground"}`}
        >
          Nhân viên thủ thư
        </button>
      </div>

      {tab === "readers" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Độc giả</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3">Thẻ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {readers?.map((reader) => (
                <tr key={reader.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={reader.full_name} />
                      <div>
                        <p className="font-medium">{reader.full_name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{reader.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{reader.email}</td>
                  <td className="px-4 py-2.5">{reader.phone}</td>
                  <td className="px-4 py-2.5">
                    {reader.library_card ? <StatusBadge status={reader.library_card.status} /> : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" className="text-sm font-medium text-accent" onClick={() => setEditingReader(reader)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {librarians?.map((librarian) => (
                <tr key={librarian.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={librarian.full_name} />
                      <div>
                        <p className="font-medium">{librarian.full_name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{librarian.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{librarian.email}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" className="text-sm font-medium text-accent" onClick={() => setEditingLibrarian(librarian)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingReader && <EditReaderDialog reader={editingReader} onClose={() => setEditingReader(null)} />}
      {editingLibrarian && (
        <EditLibrarianDialog librarian={editingLibrarian} onClose={() => setEditingLibrarian(null)} />
      )}
    </div>
  );
}
