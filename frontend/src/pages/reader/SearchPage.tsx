import { BookSearch } from "../../components/books/BookSearch";
import { BorrowRequestForm } from "../../components/loans/BorrowRequestForm";

export function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-4 font-heading text-xl font-semibold">Tra cứu sách</h1>
        <BookSearch />
      </div>
      <BorrowRequestForm />
    </div>
  );
}
