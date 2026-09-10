import { Navigate, Outlet } from "react-router-dom";

import { useMe } from "../hooks/useMe";
import type { Role } from "../types/api";

/**
 * Gates a route subtree to one or more roles, reading role from GET /api/me
 * (backed by the caller's Supabase JWT). Renders nothing while loading rather
 * than flashing the wrong shell; redirects to /login if unauthenticated, or to
 * the caller's own home if authenticated but the wrong role.
 */
export function RoleGuard({ allow }: { allow: Role[] }) {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) return null;
  if (isError || !me) return <Navigate to="/login" replace />;
  if (!allow.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;

  return <Outlet />;
}

/** Root ("/") redirect: sends an authenticated user to their role's home page,
 * and an unauthenticated one to /login — instead of hardcoding either. */
export function RootRedirect() {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) return null;
  if (isError || !me) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(me.role)} replace />;
}

export function homeFor(role: Role): string {
  switch (role) {
    case "reader":
      return "/reader/search";
    case "librarian":
      return "/librarian/counter";
    case "admin":
      return "/admin/dashboard";
  }
}
