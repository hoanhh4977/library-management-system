import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { signOut } from "../services/supabaseClient";

/**
 * Signing out of Supabase alone doesn't change what's on screen — React Query
 * keeps serving the last cached `me` (and everything derived from it) until
 * something tells it to refetch, so the old layout just sits there looking
 * "stuck". Clearing the cache before navigating is what actually kicks the
 * RoleGuard back to /login.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async () => {
    await signOut();
    queryClient.clear();
    navigate("/login", { replace: true });
  };
}
