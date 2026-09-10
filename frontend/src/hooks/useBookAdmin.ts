import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { Book } from "../types/book";

export interface BookInput {
  title: string;
  author: string;
  publisher: string;
  category: string;
  quantity: number;
  cover_image_url?: string | null;
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookInput) => api.post<Book>("/api/books", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, ...input }: { bookId: string } & Partial<BookInput>) =>
      api.patch<Book>(`/api/books/${bookId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
}
