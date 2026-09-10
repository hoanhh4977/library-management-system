import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers";

// Covers spec.md User Story 2 + quickstart.md §4 steps 1-2.
// Requires LIBRARIAN_EMAIL/LIBRARIAN_PASSWORD for a pre-seeded librarian account,
// and a Supabase project where test-signup emails are auto-confirmed (or an
// inbox-reading step substituted for the OTP fill below).
test("reader self-registers online, then a librarian issues their library card", async ({ page }) => {
  const email = `e2e-reader-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Họ tên").fill("Nguyễn Thị Kiểm Thử");
  await page.getByLabel("Ngày sinh").fill("1999-01-01");
  await page.getByLabel("Số điện thoại").fill("0900000099");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("MatKhau123!");
  await page.getByRole("button", { name: "Gửi mã xác thực Email" }).click();

  await expect(page.getByText(email)).toBeVisible();
  // OTP retrieval is environment-specific (test inbox API / Supabase test hook).
  const otp = process.env.E2E_TEST_OTP ?? "000000";
  await page.getByLabel("Mã OTP").fill(otp);
  await page.getByRole("button", { name: "Xác thực & hoàn tất đăng ký" }).click();

  // Newly registered reader lands on the read-only search page — no card yet.
  await expect(page).toHaveURL(/\/reader\/search/);

  // Librarian verifies identity and issues the card.
  await loginAs(page, process.env.LIBRARIAN_EMAIL ?? "librarian@example.com", process.env.LIBRARIAN_PASSWORD ?? "");
  await page.goto("/librarian/readers");
  await page.getByLabel("Tìm độc giả").fill(email);
  await page.getByText("Nguyễn Thị Kiểm Thử").click();
  await page.getByRole("button", { name: "Xác minh danh tính & cấp Thẻ thư viện" }).click();

  await expect(page.getByText("Hoạt động")).toBeVisible();
});
