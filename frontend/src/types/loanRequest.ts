export type LoanRequestKind = "borrow" | "renew";
export type LoanRequestStatus = "pending" | "approved" | "rejected";

export interface LoanRequestItemOut {
  book_id: string;
  book_title: string;
  book_cover_image_url: string | null;
  quantity: number;
}

export interface LoanRequest {
  id: string;
  kind: LoanRequestKind;
  status: LoanRequestStatus;
  reader_id: string;
  reader_name: string;
  loan_id: string | null;
  loan_code: string | null;
  extension_days: number | null;
  loan_period_days: number | null;
  items: LoanRequestItemOut[];
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}
