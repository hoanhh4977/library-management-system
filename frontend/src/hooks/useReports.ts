import { useQuery } from "@tanstack/react-query";

import { api } from "../services/apiClient";

export interface BookInventory {
  book_id: string;
  code: string;
  title: string;
  author: string;
  category: string;
  cover_image_url: string | null;
  total: number;
  borrowing: number;
  remaining: number;
}

export interface InventoryReport {
  books: BookInventory[];
  total_titles: number;
  total_copies: number;
  total_borrowing: number;
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => api.get<InventoryReport>("/api/reports/inventory"),
  });
}
