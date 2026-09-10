import { BookSearch } from "../../components/books/BookSearch";
import { usePageHeader } from "../../components/layouts/PageHeaderContext";

export function LibrarianSearchPage() {
  usePageHeader({ title: "Tra cứu sách", subtitle: "Tìm nhanh sách theo tên, tác giả hoặc thể loại" });
  return <BookSearch />;
}
