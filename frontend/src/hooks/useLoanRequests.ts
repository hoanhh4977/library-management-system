import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { LoanRequest } from "../types/loanRequest";

export function useMyLoanRequests() {
  return useQuery({
    queryKey: ["loan-requests", "mine"],
    queryFn: () => api.get<LoanRequest[]>("/api/loan-requests/mine"),
  });
}

/** GET /api/loan-requests is Librarian-only now (Admin only handles card-unlock
 * requests — see cards.py) — `enabled` lets Admin-shared pages (BooksPage,
 * NotificationBell) skip the call entirely instead of firing a 403. */
export function usePendingLoanRequests(enabled = true) {
  return useQuery({
    queryKey: ["loan-requests", "pending"],
    queryFn: () => api.get<LoanRequest[]>("/api/loan-requests?status_filter=pending"),
    enabled,
  });
}

/** Every request regardless of status — used to chart request volume over time,
 * distinct from usePendingLoanRequests which only shows the current backlog.
 * Librarian-only, same as usePendingLoanRequests. */
export function useAllLoanRequests(enabled = true) {
  return useQuery({
    queryKey: ["loan-requests", "all"],
    queryFn: () => api.get<LoanRequest[]>("/api/loan-requests?status_filter="),
    enabled,
  });
}

function invalidateAfterRequestChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["loan-requests"] });
  queryClient.invalidateQueries({ queryKey: ["loans"] });
  queryClient.invalidateQueries({ queryKey: ["books"] });
  queryClient.invalidateQueries({ queryKey: ["readers"] });
}

export function useCreateBorrowRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      items,
      loanPeriodDays,
    }: {
      items: { book_id: string; quantity: number }[];
      loanPeriodDays: number;
    }) => api.post<LoanRequest>("/api/loan-requests/borrow", { items, loan_period_days: loanPeriodDays }),
    onSuccess: () => invalidateAfterRequestChange(queryClient),
  });
}

export function useCreateRenewRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, extensionDays }: { loanId: string; extensionDays: number }) =>
      api.post<LoanRequest>("/api/loan-requests/renew", { loan_id: loanId, extension_days: extensionDays }),
    onSuccess: () => invalidateAfterRequestChange(queryClient),
  });
}

export function useApproveLoanRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => api.post(`/api/loan-requests/${requestId}/approve`),
    onSuccess: () => invalidateAfterRequestChange(queryClient),
  });
}

export function useRejectLoanRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => api.post(`/api/loan-requests/${requestId}/reject`),
    onSuccess: () => invalidateAfterRequestChange(queryClient),
  });
}
