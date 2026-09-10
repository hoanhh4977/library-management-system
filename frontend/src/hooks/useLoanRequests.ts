import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { LoanRequest } from "../types/loanRequest";

export function useMyLoanRequests() {
  return useQuery({
    queryKey: ["loan-requests", "mine"],
    queryFn: () => api.get<LoanRequest[]>("/api/loan-requests/mine"),
  });
}

export function usePendingLoanRequests() {
  return useQuery({
    queryKey: ["loan-requests", "pending"],
    queryFn: () => api.get<LoanRequest[]>("/api/loan-requests?status_filter=pending"),
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
    mutationFn: (items: { book_id: string; quantity: number }[]) =>
      api.post<LoanRequest>("/api/loan-requests/borrow", { items }),
    onSuccess: () => invalidateAfterRequestChange(queryClient),
  });
}

export function useCreateRenewRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (loanId: string) => api.post<LoanRequest>("/api/loan-requests/renew", { loan_id: loanId }),
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
