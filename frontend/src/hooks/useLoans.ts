import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { Loan, NewLoanResponse } from "../types/loan";

export function useReaderLoans(readerId: string | undefined) {
  return useQuery({
    queryKey: ["loans", "by-reader", readerId],
    queryFn: () => api.get<Loan[]>(`/api/readers/${readerId}/loans`),
    enabled: !!readerId,
  });
}

/** Single loan by id — powers the "xem chi tiết phiếu mượn" popup, opened from
 * anywhere a loan_code/loan reference is shown (request cards, activity rows, ...). */
export function useLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: ["loans", "detail", loanId],
    queryFn: () => api.get<Loan>(`/api/loans/${loanId}`),
    enabled: !!loanId,
  });
}

function invalidateLoanRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["loans"] });
  queryClient.invalidateQueries({ queryKey: ["readers"] });
  queryClient.invalidateQueries({ queryKey: ["books"] });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      reader_id: string;
      items: { book_id: string; quantity: number }[];
      loan_period_days: number;
    }) => api.post<NewLoanResponse>("/api/loans", payload),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useReturnItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, bookId }: { loanId: string; bookId: string }) =>
      api.post(`/api/loans/${loanId}/items/${bookId}/return`),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useRenewLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, extensionDays }: { loanId: string; extensionDays: number }) =>
      api.post(`/api/loans/${loanId}/renew`, { extension_days: extensionDays }),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useReportLost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, bookId }: { loanId: string; bookId: string }) =>
      api.post(`/api/loans/${loanId}/items/${bookId}/report-lost`),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useConfirmCompensation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loanId, bookId }: { loanId: string; bookId: string }) =>
      api.post(`/api/loans/${loanId}/items/${bookId}/confirm-compensation`),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}
