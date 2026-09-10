import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers";

// Covers spec.md User Story 1 + quickstart.md §4 steps 4-5.
// Requires a pre-seeded Librarian account, a Reader with an active card
// (READER_NAME), and a Book with available stock (SEED_BOOK_TITLE).
test("librarian lends a book to a reader, then records the return", async ({ page }) => {
  const readerName = process.env.READER_NAME ?? "Nguyễn Thị Minh Anh";
  const bookTitle = process.env.SEED_BOOK_TITLE ?? "Sapiens";

  await loginAs(page, process.env.LIBRARIAN_EMAIL ?? "librarian@example.com", process.env.LIBRARIAN_PASSWORD ?? "");
  await expect(page).toHaveURL(/\/librarian\/counter/);

  await page.getByLabel("Tìm độc giả").fill(readerName);
  await page.getByText(readerName).first().click();
  await expect(page.getByText("Hoạt động")).toBeVisible();

  await page.getByPlaceholder("Tìm sách để thêm vào phiếu…").fill(bookTitle);
  await page.getByText(bookTitle, { exact: false }).first().click();
  await page.getByRole("button", { name: "Xác nhận lập phiếu" }).click();

  const row = page.getByRole("row").filter({ hasText: bookTitle });
  await expect(row.getByText("Đang mượn")).toBeVisible();

  await row.getByRole("button", { name: "Hành động khác" }).click();
  await page.getByRole("button", { name: "Trả sách" }).click();

  await expect(row.getByText("Đã trả")).toBeVisible();
});
