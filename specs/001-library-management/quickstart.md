# Quickstart: Library Management System

Hướng dẫn chạy và kiểm chứng feature `001-library-management` end-to-end. Không lặp lại chi tiết schema/API — xem `data-model.md` và `contracts/api-contracts.md`.

## 1. Chuẩn bị môi trường

`.env` ở repo root đã có sẵn (không commit thêm giá trị thật vào git):

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
SUPABASE_JWKS_URL=...
```

Backend cần thêm `DATABASE_URL` (connection string Postgres của cùng project Supabase, lấy từ Supabase Dashboard → Project Settings → Database) để SQLAlchemy kết nối trực tiếp (xem `research.md` §1).

Frontend cần các biến tương ứng với tiền tố `VITE_` (Vite chỉ expose biến có tiền tố này ra client): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` (trỏ tới backend, ví dụ `http://localhost:8000` khi dev).

## 2. Chạy Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # hoặc .venv\Scripts\activate trên Windows
pip install -r requirements.txt
alembic upgrade head        # tạo schema theo data-model.md
uvicorn src.main:app --reload --port 8000
```

Kiểm tra nhanh: `GET http://localhost:8000/api/books` (kèm JWT hợp lệ) trả `200` với danh sách rỗng ban đầu.

## 3. Chạy Frontend

```bash
cd frontend
npm install
npm run dev      # Vite dev server, mặc định http://localhost:5173
```

## 4. Kịch bản kiểm chứng (khớp Acceptance Scenarios trong `spec.md`)

Chạy tuần tự để xác nhận luồng lõi hoạt động đúng:

1. **Đăng ký Độc giả (User Story 2)**: Tại `/register`, tạo tài khoản mới (email chưa dùng). Xác nhận nhận được email OTP/liên kết xác thực từ Supabase Auth; sau khi xác thực, đăng nhập được và thấy trang tra cứu sách + "Lịch sử mượn: trống" — nhưng KHÔNG thấy tùy chọn mượn sách (chưa có thẻ).
2. **Cấp Thẻ thư viện (User Story 2)**: Đăng nhập vai Librarian, vào hồ sơ Độc giả vừa tạo, xác nhận danh tính và cấp thẻ. Xác nhận `GET /api/readers/{id}` trả `library_card.status = "active"`.
3. **Thêm Sách (User Story 8)**: Đăng nhập vai Admin, thêm 1 Sách với `quantity = 2`. Xác nhận sách xuất hiện khi tra cứu (User Story 3) từ tài khoản Reader.
4. **Mượn sách (User Story 1)**: Vai Librarian, lập Phiếu mượn cho Độc giả ở bước 2 với Sách ở bước 3, `quantity = 1`. Xác nhận: `books.quantity` giảm còn 1; `loan_details.status = "borrowing"`; Reader đăng nhập lại thấy phiếu mượn trong lịch sử.
5. **Trả sách trễ hạn (User Story 1 + 7)**: Chỉnh `due_date` của phiếu mượn ở bước 4 về một ngày trong quá khứ (thao tác test-only qua DB hoặc chờ thật nếu test theo thời gian thực), thử lập phiếu mượn mới cho cùng Độc giả → phải bị từ chối (thẻ tự khóa). Ghi nhận trả sách → `status = "returned"`, `books.quantity` cộng lại về 2, hệ thống báo "trả trễ hạn".
6. **Mở khóa thẻ (User Story 7)**: Sau bước 5 (không còn sách quá hạn), vai Librarian gửi yêu cầu mở khóa; vai Admin phê duyệt. Xác nhận `library_cards.status = "active"` và `card_unlock_requests.reviewed_by/reviewed_at` được ghi nhận (audit trail — FR-011).
7. **Báo cáo tồn kho (User Story 9)**: Vai Admin xem `GET /api/reports/inventory`, xác nhận số liệu khớp với dữ liệu vừa tạo ở các bước trên.

## 5. Test tự động

```bash
# Backend
cd backend && pytest

# Frontend unit
cd frontend && npm run test

# End-to-end (Playwright) — chạy với backend + frontend đã start (bước 2, 3),
# hoặc trỏ BASE_URL tới Vercel preview deployment + backend staging trên Render
cd frontend && npx playwright test
```

Bộ Playwright spec tối thiểu cần có (map 1-1 với bước 1-6 ở trên): `register-and-issue-card.spec.ts`, `search-books.spec.ts`, `borrow-return-flow.spec.ts`, `overdue-lock-unlock.spec.ts`. Đây là các luồng rủi ro cao nhất trong spec (nhiều bảng, nhiều vai trò phối hợp) nên bắt buộc có E2E thật, không chỉ unit test.

## 6. Deploy

- **Backend → Render**: tạo Web Service từ repo, root directory `backend/`, build command `pip install -r requirements.txt && alembic upgrade head`, start command `uvicorn src.main:app --host 0.0.0.0 --port $PORT`. Khai báo `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `DATABASE_URL` trong Render → Environment.
- **Frontend → Vercel**: import repo, root directory `frontend/`, framework preset Vite. Khai báo `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` (URL backend Render) trong Vercel → Environment Variables. Mỗi PR tự có preview deployment — dùng preview này để chạy Playwright trước khi merge (xem `research.md` §6).
