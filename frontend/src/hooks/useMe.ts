import { useQuery } from "@tanstack/react-query";

import { api } from "../services/apiClient";
import type { Me } from "../types/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/api/me"),
    retry: false,
  });
}
