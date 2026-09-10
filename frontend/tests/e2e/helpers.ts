import type { Page } from "@playwright/test";

/**
 * These E2E specs assume a running stack (see quickstart.md §2-3) pointed at a
 * disposable *test* Supabase project (or one with auto-confirm enabled for test
 * users) — never the team's shared/production Supabase project, since these
 * flows create real auth users, readers, books and loans.
 *
 * Login helper: goes through the real LoginPage form. For a librarian/admin,
 * the account must already exist in Supabase Auth + `profiles` (seeded via the
 * Admin API or a fixture script — not part of these specs).
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}
