import { BookSearch } from "../../components/books/BookSearch";
import { BorrowRequestForm } from "../../components/loans/BorrowRequestForm";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";

export function SearchPage() {
  usePageHeader({ title: "Tra cứu sách", subtitle: "Tìm sách và gửi yêu cầu mượn tới thủ thư" });

  return (
    <div className="flex flex-col gap-6">
      <BookSearch />
      <BorrowRequestForm />
    </div>
  );
}
