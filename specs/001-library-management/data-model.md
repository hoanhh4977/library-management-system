# Data Model: Library Management System

Nguồn: `spec.md` (Key Entities), đối chiếu `docs/ERD.png` và `docs/Data Dict _ Process Spec.pdf`. Tên bảng/cột dùng `snake_case` tiếng Anh cho code, giữ chú thích tiếng Việt để truy vết về nghiệp vụ gốc.

## Tổng quan quan hệ

```
profiles (role=reader) 1───0..1 library_cards
profiles (role=reader) 1───0..* loans
profiles (role=librarian) 1───0..* loans          (người lập)
profiles (role=librarian) 1───0..* card_unlock_requests   (người gửi yêu cầu)
profiles (role=admin)     1───0..* card_unlock_requests   (người phê duyệt)
loans          1───1..* loan_details
books          1───0..* loan_details
library_cards  1───0..* card_unlock_requests
```

## profiles

Thay cho 3 thực thể "Độc giả / Nhân viên thủ thư / Quản trị viên" (đều có Họ tên, Ngày sinh, đều đăng nhập qua Supabase Auth) — xem `research.md` §3 cho lý do gộp bảng.

| Cột | Kiểu | Ràng buộc | Nguồn nghiệp vụ |
|---|---|---|---|
| `id` | uuid | PK, = `auth.users.id` (Supabase) | — |
| `role` | enum(`reader`,`librarian`,`admin`) | NOT NULL | Vai trò (FR-026) |
| `code` | text | UNIQUE trong phạm vi từng `role` | Mã độc giả/Mã nhân viên/Mã quản trị viên (DE07/DE15/DE16) |
| `full_name` | text | NOT NULL | Họ tên (DE08) |
| `date_of_birth` | date | NOT NULL | Ngày sinh (DE09) |
| `phone` | text | NULL nếu `role != reader`; nếu có, đúng định dạng SĐT | Số điện thoại (DE10), chỉ áp dụng Độc giả |
| `email` | text | UNIQUE toàn hệ thống, NOT NULL, = email trong Supabase Auth | Email (DE11); dùng làm định danh đăng nhập (FR-004) |
| `email_verified_at` | timestamptz | NULL cho tới khi xác thực OTP xong | FR-005 |
| `created_at` | timestamptz | NOT NULL, default now() | — |

**Validation**: `email` duy nhất toàn hệ thống (FR-004). `code` tự sinh, duy nhất trong phạm vi vai trò (không bắt buộc duy nhất toàn bảng nếu muốn tái dùng số thứ tự riêng cho từng vai trò — quyết định cụ thể do team dev chốt khi viết migration). Tài khoản `role=reader` có thể tồn tại mà chưa có `library_cards` liên kết (xem Edge Case "chưa ra quầy").

## library_cards

Thẻ thư viện — quan hệ 0..1 với `profiles(role=reader)` cho tới khi được cấp, sau đó 1-1 lâu dài (FR-007, FR-008).

| Cột | Kiểu | Ràng buộc | Nguồn nghiệp vụ |
|---|---|---|---|
| `id` | uuid | PK | Mã thẻ (DE12) |
| `code` | text | UNIQUE | Mã thẻ hiển thị |
| `reader_id` | uuid | FK → `profiles.id` (role=reader), UNIQUE (đảm bảo 1 thẻ/độc giả) | FR-008 |
| `issued_at` | date | NOT NULL, default ngày hiện tại | Ngày cấp (DE13) |
| `issued_by` | uuid | FK → `profiles.id` (role=librarian), NOT NULL | "Thủ thư xác minh danh tính và cấp thẻ" (FR-007) |
| `status` | enum(`active`,`locked`) | NOT NULL, default `active` | Trạng thái (DE14) |

**State transitions**: `active → locked` (tự động, hệ thống phát hiện quá hạn/chưa đền bù — FR-009); `locked → active` chỉ qua `card_unlock_requests` được `admin` phê duyệt (FR-011). Không có transition `locked → locked` hay bỏ qua `card_unlock_requests`.

## card_unlock_requests

| Cột | Kiểu | Ràng buộc | Nguồn nghiệp vụ |
|---|---|---|---|
| `id` | uuid | PK | — |
| `card_id` | uuid | FK → `library_cards.id`, NOT NULL | FR-010 |
| `requested_by` | uuid | FK → `profiles.id` (role=librarian), NOT NULL | "Thủ thư gửi yêu cầu" |
| `requested_at` | timestamptz | NOT NULL, default now() | — |
| `status` | enum(`pending`,`approved`,`rejected`) | NOT NULL, default `pending` | — |
| `reviewed_by` | uuid | FK → `profiles.id` (role=admin), NULL cho tới khi xử lý | FR-011 (audit trail) |
| `reviewed_at` | timestamptz | NULL cho tới khi xử lý | FR-011 (audit trail) |

**Validation**: Không tạo request mới nếu Độc giả vẫn còn sách quá hạn/chưa đền bù (từ chối ngay — Acceptance Scenario US7.4); tối đa 1 request `pending` cho mỗi `card_id` tại một thời điểm (tránh trùng yêu cầu).

## books

| Cột | Kiểu | Ràng buộc | Nguồn nghiệp vụ |
|---|---|---|---|
| `id` | uuid | PK | Mã sách (DE01) |
| `code` | text | UNIQUE, tự sinh | — |
| `title` | text | NOT NULL | Tên sách (DE02) |
| `author` | text | NOT NULL | Tác giả (DE03) |
| `publisher` | text | NOT NULL | Nhà xuất bản (DE04) |
| `category` | text | NOT NULL | Thể loại (DE05) |
| `quantity` | integer | NOT NULL, CHECK (`quantity >= 0`) | Số lượng (DE06) |

**Validation**: `quantity` không được âm sau khi trừ tồn kho (FR-015) — thực thi bằng transaction + CHECK constraint làm lớp bảo vệ cuối. Tra cứu (FR-003) index trên `title`, `author`, `category` (ví dụ `pg_trgm`/full-text search nếu cần tốc độ với kho lớn).

## loans

| Cột | Kiểu | Ràng buộc | Nguồn nghiệp vụ |
|---|---|---|---|
| `id` | uuid | PK | Mã phiếu mượn (DE17) |
| `code` | text | UNIQUE | — |
| `reader_id` | uuid | FK → `profiles.id` (role=reader), NOT NULL | Mã độc giả |
| `librarian_id` | uuid | FK → `profiles.id` (role=librarian), NOT NULL | Mã nhân viên |
| `loan_date` | date | NOT NULL, default ngày hiện tại | Ngày mượn (DE18) |
| `due_date` | date | NOT NULL, >= `loan_date` | Ngày hẹn trả (DE19); mặc định `loan_date + 14 ngày` (FR-013) |
| `renewed` | boolean | NOT NULL, default `false` | Gia hạn — Rồi/Chưa (DE20) |

**Validation**: `renewed` chỉ chuyển `false → true` một lần (FR-018); khi gia hạn, `due_date += 7 ngày`, chỉ cho phép nếu `due_date` gốc (tại thời điểm gia hạn) chưa qua ngày hiện tại.

## loan_details

Khóa chính kết hợp — quan hệ nhiều-nhiều giữa `loans` và `books` (FR-014).

| Cột | Kiểu | Ràng buộc | Nguồn nghiệp vụ |
|---|---|---|---|
| `loan_id` | uuid | FK → `loans.id`, phần của PK | Mã phiếu mượn |
| `book_id` | uuid | FK → `books.id`, phần của PK | Mã sách |
| `quantity` | integer | NOT NULL, CHECK (`quantity > 0`) | Số lượng mượn (DE21) |
| `actual_return_date` | date | NULL cho tới khi trả | Ngày trả thực tế (DE22), NULL = chưa trả |
| `status` | enum(`borrowing`,`returned`,`pending_compensation`,`compensated`) | NOT NULL, default `borrowing` | Trạng thái (DE23) |
| `compensation_confirmed_by` | uuid | FK → `profiles.id`, NULL cho tới khi đền bù xong | FR-021 (audit trail) |
| `compensation_confirmed_at` | timestamptz | NULL cho tới khi đền bù xong | FR-021 (audit trail) |

**State transitions** (mỗi dòng độc lập, cho phép trả từng sách khác thời điểm — FR-016):
```
borrowing ──(trả sách)──► returned
borrowing ──(báo mất)───► pending_compensation ──(xác nhận đền bù hợp lệ)──► compensated
```
Không có transition `returned → *` hay `compensated → *` (trạng thái cuối).

**Business rule tính "quá hạn"** (dùng ở nhiều FR, xem `research.md` §4): một dòng `loan_details` được coi là "vi phạm" (chặn mượn thêm/khóa thẻ — FR-009, FR-012, FR-020) khi:
- `status = 'borrowing' AND loans.due_date < ngày hiện tại`, HOẶC
- `status = 'pending_compensation'`.

## Tổng hợp ánh xạ Functional Requirements → ràng buộc dữ liệu

| FR | Ràng buộc/entity liên quan |
|---|---|
| FR-001–003 | `books`: unique `code`, tra cứu theo `title/author/category` |
| FR-004–006 | `profiles(role=reader)`: unique `email`, `email_verified_at` |
| FR-007–008 | `library_cards`: unique `reader_id`, `issued_by` |
| FR-009–011 | `library_cards.status`, `card_unlock_requests` (+ audit `reviewed_by/at`) |
| FR-012–018 | `loans`, `loan_details`, `books.quantity` (transaction) |
| FR-019–021 | `loan_details.status = pending_compensation/compensated` (+ audit) |
| FR-022–023 | Truy vấn hợp `loans` + `loan_details` theo `reader_id` |
| FR-024–025 | Aggregate trên `books`/`loan_details`; CRUD trên `profiles` |
| FR-026–028 | Kiểm tra `role` ở tầng API (FastAPI dependency), không phải constraint DB |
