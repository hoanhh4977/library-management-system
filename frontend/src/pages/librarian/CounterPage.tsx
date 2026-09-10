import { useState } from "react";

import { ReaderPicker } from "../../components/readers/ReaderPicker";
import { NewLoanForm } from "../../components/loans/NewLoanForm";
import { LoanDetailsTable } from "../../components/loans/LoanDetailsTable";
import { useReaderLoans } from "../../hooks/useLoans";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";
import type { Reader } from "../../types/reader";

export function CounterPage() {
  const [reader, setReader] = useState<Reader | null>(null);
  const { data: loans } = useReaderLoans(reader?.id);

  usePageHeader({ title: "Quầy giao dịch", subtitle: "Lập phiếu mượn, trả sách và gia hạn cho độc giả" });

  return (
    <div className="flex flex-col gap-4">
      <ReaderPicker selected={reader} onSelect={setReader} />

      {reader && (
        <>
          <NewLoanForm readerId={reader.id} cardStatus={reader.library_card?.status} onDone={() => {}} />
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 font-heading text-sm font-semibold">Phiếu mượn của độc giả</p>
            <LoanDetailsTable loans={loans ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
