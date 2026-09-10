import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers";

// Covers spec.md User Story 3 + quickstart.md §4 step 3.
// Requires a pre-seeded Reader account (READER_EMAIL/READER_PASSWORD) and at
// least one Book already in the catalog matching SEED_BOOK_TITLE.
test("reader searches the catalog and sees live remaining quantity", async ({ page }) => {
  await loginAs(page, process.env.READER_EMAIL ?? "reader@example.com", process.env.READER_PASSWORD ?? "");
  await expect(page).toHaveURL(/\/reader\/search/);

  const seedTitle = process.env.SEED_BOOK_TITLE ?? "Sapiens";
  await page.getByLabel("Tra cứu sách").fill(seedTitle);

  await expect(page.getByText(seedTitle)).toBeVisible();
  await expect(page.getByText(/^còn \d+$/)).toBeVisible();
});

test("searching for a title that doesn't exist shows an empty-result message", async ({ page }) => {
  await loginAs(page, process.env.READER_EMAIL ?? "reader@example.com", process.env.READER_PASSWORD ?? "");
  await page.getByLabel("Tra cứu sách").fill(`khong-ton-tai-${Date.now()}`);

  await expect(page.getByText("Không tìm thấy kết quả.")).toBeVisible();
});
