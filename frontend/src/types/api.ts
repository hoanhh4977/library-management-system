export type Role = "reader" | "librarian" | "admin";

export interface CardSummary {
  status: "active" | "locked";
  code: string;
  issued_at: string;
}

export interface Me {
  id: string;
  role: Role;
  code: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string;
  library_card: CardSummary | null;
}

export type LoanDetailStatus = "borrowing" | "returned" | "pending_compensation" | "compensated";
