import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers";

// Covers spec.md User Story 7 + quickstart.md §4 step 6.
// Requires a Reader whose card is already `locked` from an overdue loan
// (seeded ahead of time — see backend/tests/integration/test_lock_unlock_flow.py
// for the equivalent scenario setup) and an Admin account.
test("librarian requests an unlock, admin approves it, card becomes active again", async ({ page }) => {
  const readerName = process.env.LOCKED_READER_NAME ?? "Phạm Quốc Đạt";

  await loginAs(page, process.env.LIBRARIAN_EMAIL ?? "librarian@example.com", process.env.LIBRARIAN_PASSWORD ?? "");
  await page.goto("/librarian/readers");
  await page.getByLabel("Tìm độc giả").fill(readerName);
  await page.getByText(readerName).first().click();

  await expect(page.getByText("Bị khóa")).toBeVisible();
  await page.getByRole("button", { name: "Gửi yêu cầu mở khóa" }).click();
  await expect(page.getByText("Đã gửi yêu cầu mở khóa")).toBeVisible();

  await loginAs(page, process.env.ADMIN_EMAIL ?? "admin@example.com", process.env.ADMIN_PASSWORD ?? "");
  await page.goto("/admin/unlock-requests");

  const row = page.getByRole("listitem").filter({ hasText: readerName });
  await row.getByRole("button", { name: "Phê duyệt" }).click();
  await expect(row).not.toBeVisible();

  // Back to the librarian's view to confirm the card is active again.
  await loginAs(page, process.env.LIBRARIAN_EMAIL ?? "librarian@example.com", process.env.LIBRARIAN_PASSWORD ?? "");
  await page.goto("/librarian/readers");
  await page.getByLabel("Tìm độc giả").fill(readerName);
  await page.getByText(readerName).first().click();
  await expect(page.getByText("Hoạt động")).toBeVisible();
});
