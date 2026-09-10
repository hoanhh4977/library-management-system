# API Contracts: Library Management System

REST API do backend FastAPI cung cấp. Mọi endpoint (trừ nhóm Auth) yêu cầu header `Authorization: Bearer <supabase_jwt>`; backend xác thực JWT qua `SUPABASE_JWKS_URL` rồi kiểm tra `role` trong bảng `profiles`. Định dạng lỗi chuẩn: `{"detail": "<message>"}` với mã HTTP tương ứng (400 validate, 401 chưa đăng nhập, 403 sai quyền, 404 không tồn tại, 409 xung đột nghiệp vụ — ví dụ thẻ bị khóa, hết hàng, đã gia hạn).

## Auth (Supabase Auth, không do FastAPI xử lý)

Đăng ký/đăng nhập/xác thực OTP Email của Độc giả (FR-004, FR-005) đi trực tiếp qua Supabase Auth từ frontend (`@supabase/supabase-js`), KHÔNG qua FastAPI. FastAPI chỉ có một endpoint hỗ trợ:

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/me` | Bất kỳ (đã đăng nhập) | Trả về `profile` hiện tại (role, code, full_name, có/chưa có library_card) — dùng để frontend route theo vai trò |

## Books (`/api/books`) — FR-001, FR-002, FR-003

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/books?q=&field=title\|author\|category` | reader, librarian, admin | Tra cứu sách (FR-003), trả `quantity` còn lại |
| POST | `/api/books` | admin | Thêm sách mới (FR-001) — 409 nếu trùng logic nghiệp vụ (không áp dụng, `code` tự sinh) |
| PATCH | `/api/books/{book_id}` | admin | Cập nhật thông tin/số lượng sách (FR-002) |

## Readers & Library Cards (`/api/readers`, `/api/cards`) — FR-006–011

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/readers/{reader_id}` | librarian, admin | Xem thông tin Độc giả (cần trước khi cấp thẻ/lập phiếu mượn) |
| GET | `/api/readers` | admin | Danh sách Độc giả (FR-025) |
| PATCH | `/api/readers/{reader_id}` | admin | Cập nhật thông tin Độc giả (FR-025) |
| POST | `/api/readers/{reader_id}/card` | librarian | Xác minh danh tính + cấp Thẻ thư viện (FR-007) — 409 nếu đã có thẻ (FR-008) hoặc `reader_id` chưa từng tự đăng ký |
| POST | `/api/cards/{card_id}/unlock-requests` | librarian | Gửi yêu cầu mở khóa (FR-010) — 409 nếu Độc giả còn vi phạm (từ chối ngay, Acceptance Scenario US7.4) |
| POST | `/api/cards/{card_id}/unlock-requests/{request_id}/approve` | admin | Phê duyệt mở khóa (FR-011) — ghi `reviewed_by`/`reviewed_at`, chuyển thẻ `active` |
| POST | `/api/cards/{card_id}/unlock-requests/{request_id}/reject` | admin | Từ chối yêu cầu mở khóa |

## Librarians (`/api/librarians`) — FR-025

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/librarians` | admin | Danh sách Nhân viên thủ thư |
| PATCH | `/api/librarians/{librarian_id}` | admin | Cập nhật thông tin |

## Loans (`/api/loans`) — FR-012–018

| Method | Path | Role | Mô tả |
|---|---|---|---|
| POST | `/api/loans` | librarian | Lập Phiếu mượn: `{reader_id, items: [{book_id, quantity}]}` (FR-012, FR-014) — 409 nếu thẻ bị khóa/có sách quá hạn/chưa đền bù (FR-012); trả về kết quả từng `item` riêng nếu một số đầu sách không đủ hàng (FR-015, Acceptance Scenario US1.3) |
| GET | `/api/loans/{loan_id}` | reader (chỉ của mình), librarian, admin | Chi tiết một Phiếu mượn + các `loan_details` |
| POST | `/api/loans/{loan_id}/renew` | librarian | Gia hạn (FR-018) — 409 nếu quá hạn hoặc đã gia hạn |
| POST | `/api/loans/{loan_id}/items/{book_id}/return` | librarian | Trả một cuốn sách trong phiếu (FR-016, FR-017) — trả kèm cờ `on_time: true/false` |
| POST | `/api/loans/{loan_id}/items/{book_id}/report-lost` | librarian | Báo mất (FR-019) → `pending_compensation` |
| POST | `/api/loans/{loan_id}/items/{book_id}/confirm-compensation` | librarian, admin | Xác nhận đền bù hợp lệ (FR-021) — ghi `compensation_confirmed_by/at`, 409 nếu thông tin sách đền bù không khớp |

## Loan History (`/api/readers/{reader_id}/loans`) — FR-022, FR-023

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/readers/{reader_id}/loans` | reader (chỉ `reader_id` = chính mình, 403 nếu khác), librarian, admin | Lịch sử mượn đầy đủ: danh sách `loans` + `loan_details`, gồm trạng thái từng sách và các lần trả trễ |

## Reports (`/api/reports`) — FR-024

| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/api/reports/inventory` | admin | Báo cáo tồn kho on-demand: theo từng sách (`total`, `borrowing`, `remaining`) + tổng hợp toàn hệ thống |

## Ghi chú kiểm thử hợp đồng (contract tests)

Mỗi endpoint trên cần tối thiểu: 1 test "happy path" đúng role, 1 test 403 (role sai), 1 test lỗi nghiệp vụ chính (409 tương ứng cột "Mô tả"). Các endpoint mượn/trả/gia hạn/đền bù cần thêm integration test end-to-end xuyên nhiều bước (mượn → trả trễ → khóa thẻ → yêu cầu mở khóa → phê duyệt) để khớp Edge Cases trong `spec.md`.
