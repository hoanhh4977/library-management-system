import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { Librarian, Reader } from "../types/reader";

export function useReaderSearch(query: string) {
  return useQuery({
    queryKey: ["readers", "search", query],
    queryFn: () => api.get<Reader[]>(`/api/readers?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });
}

export function useAllReaders() {
  return useQuery({ queryKey: ["readers", "all"], queryFn: () => api.get<Reader[]>("/api/readers") });
}

export function useAllLibrarians() {
  return useQuery({ queryKey: ["librarians", "all"], queryFn: () => api.get<Librarian[]>("/api/librarians") });
}

export function useReader(readerId: string | undefined) {
  return useQuery({
    queryKey: ["readers", readerId],
    queryFn: () => api.get<Reader>(`/api/readers/${readerId}`),
    enabled: !!readerId,
  });
}

export function useIssueCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (readerId: string) => api.post(`/api/readers/${readerId}/card`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["readers"] }),
  });
}

export function useUpdateReader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ readerId, ...body }: { readerId: string } & Record<string, unknown>) =>
      api.patch(`/api/readers/${readerId}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["readers"] }),
  });
}

export function useUpdateLibrarian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ librarianId, ...body }: { librarianId: string } & Record<string, unknown>) =>
      api.patch(`/api/librarians/${librarianId}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["librarians"] }),
  });
}

export function useDeleteReader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (readerId: string) => api.delete(`/api/readers/${readerId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["readers"] }),
  });
}

export function useDeleteLibrarian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (librarianId: string) => api.delete(`/api/librarians/${librarianId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["librarians"] }),
  });
}

export interface CreateLibrarianResponse {
  librarian: Librarian;
  temporary_password: string;
}

export function useCreateLibrarian() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { full_name: string; email: string; date_of_birth: string }) =>
      api.post<CreateLibrarianResponse>("/api/librarians", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["librarians"] }),
  });
}
