export type LoanDetailRawStatus = "borrowing" | "returned" | "pending_compensation" | "compensated";

export interface LoanDetail {
  book_id: string;
  book_title: string;
  book_cover_image_url: string | null;
  quantity: number;
  actual_return_date: string | null;
  status: LoanDetailRawStatus;
}

export interface Loan {
  id: string;
  code: string;
  reader_id: string;
  librarian_id: string;
  loan_date: string;
  due_date: string;
  renewed: boolean;
  details: LoanDetail[];
}

export interface LoanItemResult {
  book_id: string;
  ok: boolean;
  detail: string | null;
}

export interface NewLoanResponse {
  loan: Loan | null;
  items: LoanItemResult[];
}
