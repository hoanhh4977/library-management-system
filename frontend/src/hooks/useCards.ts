import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../services/apiClient";

export interface UnlockRequest {
  id: string;
  card_id: string;
  card_code: string;
  reader_id: string;
  reader_name: string;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
}

export function usePendingUnlockRequests() {
  return useQuery({
    queryKey: ["unlock-requests", "pending"],
    queryFn: () => api.get<UnlockRequest[]>("/api/cards/unlock-requests?status_filter=pending"),
  });
}

export function useRequestUnlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => api.post<{ id: string; status: string }>(`/api/cards/${cardId}/unlock-requests`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["readers"] }),
  });
}

export function useReviewUnlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, requestId, decision }: { cardId: string; requestId: string; decision: "approve" | "reject" }) =>
      api.post(`/api/cards/${cardId}/unlock-requests/${requestId}/${decision}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["readers"] });
      queryClient.invalidateQueries({ queryKey: ["unlock-requests"] });
    },
  });
}
