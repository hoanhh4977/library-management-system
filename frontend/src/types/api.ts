export type Role = "reader" | "librarian" | "admin";

export interface CardSummary {
  status: "active" | "locked";
  code: string;
}

export interface Me {
  id: string;
  role: Role;
  code: string;
  full_name: string;
  library_card: CardSummary | null;
}

export type LoanDetailStatus = "borrowing" | "returned" | "pending_compensation" | "compensated";
