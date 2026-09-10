import { useQuery } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { Book } from "../types/book";

export function useBookSearch(query: string) {
  return useQuery({
    queryKey: ["books", "search", query],
    queryFn: () => api.get<Book[]>(`/api/books?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });
}

export function useAllBooks() {
  return useQuery({
    queryKey: ["books", "all"],
    queryFn: () => api.get<Book[]>("/api/books"),
  });
}
