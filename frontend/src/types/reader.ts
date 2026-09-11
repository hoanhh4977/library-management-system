export interface LibraryCardInfo {
  id: string;
  code: string;
  status: "active" | "locked";
  issued_at: string;
}

export interface Reader {
  id: string;
  code: string;
  full_name: string;
  date_of_birth: string;
  phone: string | null;
  email: string;
  library_card: LibraryCardInfo | null;
  created_at: string;
}

export interface Librarian {
  id: string;
  code: string;
  full_name: string;
  date_of_birth: string;
  email: string;
}
