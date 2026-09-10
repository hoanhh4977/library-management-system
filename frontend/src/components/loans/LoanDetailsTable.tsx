import { useState } from "react";
import { DotsThree } from "@phosphor-icons/react";

import { useConfirmCompensation, useRenewLoan, useReportLost, useReturnItem } from "../../hooks/useLoans";
import { StatusBadge, loanDetailStatus } from "../StatusBadge";
import { BookCover } from "../books/BookCover";
import type { Loan } from "../../types/loan";

function RowActions({ loan, bookId, status }: { loan: Loan; bookId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const returnItem = useReturnItem();
  const renew = useRenewLoan();
  const reportLost = useReportLost();
  const confirmCompensation = useConfirmCompensation();

  const busy =
    returnItem.isPending || renew.isPending || reportLost.isPending || confirmCompensation.isPending;

  if (status === "returned" || status === "compensated") return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label="Hành động khác"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
      >
        <DotsThree size={18} weight="bold" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-border bg-card py-1 text-sm shadow-sm">
          {status === "borrowing" && (
            <>
              <button
                className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  returnItem.mutate({ loanId: loan.id, bookId });
                }}
              >
                Trả sách
              </button>
              {!loan.renewed && (
                <button
                  className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setOpen(false);
                    renew.mutate(loan.id);
                  }}
                >
                  Gia hạn
                </button>
              )}
              <button
                className="block w-full px-3 py-1.5 text-left text-danger-foreground hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  reportLost.mutate({ loanId: loan.id, bookId });
                }}
              >
                Báo mất
              </button>
            </>
          )}
          {status === "pending_compensation" && (
            <button
              className="block w-full px-3 py-1.5 text-left hover:bg-muted"
              onClick={() => {
                setOpen(false);
                confirmCompensation.mutate({ loanId: loan.id, bookId });
              }}
            >
              Xác nhận đền bù
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LoanDetailsTable({ loans }: { loans: Loan[] }) {
  const rows = loans.flatMap((loan) => loan.details.map((detail) => ({ loan, detail })));

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Độc giả chưa có phiếu mượn nào.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2">Sách</th>
            <th className="py-2">Hẹn trả</th>
            <th className="py-2">Trạng thái</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ loan, detail }) => {
            const status = loanDetailStatus(detail.status, loan.due_date);
            return (
              <tr key={`${loan.id}-${detail.book_id}`} className="border-b border-border">
                <td className="py-2">
                  <div className="flex items-center gap-2.5">
                    <BookCover src={detail.book_cover_image_url} title={detail.book_title} size="sm" />
                    <div>
                      {detail.book_title}
                      <div className="font-mono text-xs text-muted-foreground">{loan.code}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2 font-mono">{loan.due_date}</td>
                <td className="py-2">
                  <StatusBadge status={status} />
                </td>
                <td className="py-2 text-right">
                  <RowActions loan={loan} bookId={detail.book_id} status={detail.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
