# Research: Library Management System

Tài liệu này tổng hợp các quyết định kỹ thuật cho Phase 0, giải quyết mọi điểm chưa rõ trong Technical Context của `plan.md`. Không còn `NEEDS CLARIFICATION` nào sau tài liệu này.

## 1. Truy cập dữ liệu: SQLAlchemy (async) trực tiếp vào Postgres, không qua PostgREST của Supabase

- **Decision**: Backend FastAPI dùng SQLAlchemy 2.0 (async engine) + `asyncpg`, kết nối trực tiếp tới Postgres của Supabase qua connection string dựng từ `SUPABASE_URL`/`SUPABASE_SECRET_KEY` (hoặc `DATABASE_URL` nếu Supabase cung cấp riêng). Alembic quản lý migration schema.
- **Rationale**: Nhiều quy tắc nghiệp vụ (FR-012, FR-015, FR-017) đòi hỏi ghi đồng thời nhiều bảng trong một transaction (tạo Phiếu mượn + Chi tiết phiếu mượn + trừ tồn kho Sách). SQLAlchemy async cho kiểm soát transaction rõ ràng (`async with session.begin():`), dễ viết unit/integration test với DB thật hoặc test container, và giữ toàn bộ business logic tập trung trong FastAPI thay vì rải sang tầng PostgREST/RLS của Supabase.
- **Alternatives considered**:
  - `supabase-py` (client PostgREST) cho toàn bộ CRUD — bị loại vì PostgREST thực hiện từng request độc lập, khó đảm bảo transaction đa bảng nguyên tử, và đẩy một phần logic phân quyền vào Row-Level-Security thay vì tập trung ở service layer FastAPI (khó test, khó audit).
  - Supabase Row-Level-Security (RLS) làm lớp phân quyền chính — vẫn có thể bật thêm như lớp phòng thủ thứ hai (defense-in-depth) ở giai đoạn sau, nhưng không phải là cơ chế phân quyền chính cho MVP để tránh trùng lặp logic giữa FastAPI và RLS policy.

## 2. Xác thực & phân quyền: Supabase Auth (GoTrue) + xác thực JWT bằng JWKS ở FastAPI

- **Decision**: Độc giả tự đăng ký/đăng nhập qua Supabase Auth (email + mật khẩu, xác thực Email bằng OTP/magic link — đúng FR-004/FR-005) dùng `@supabase/supabase-js` ở frontend với `SUPABASE_PUBLISHABLE_KEY`. Nhân viên thủ thư và Quản trị viên được tạo tài khoản Supabase Auth trước (nội bộ, không tự đăng ký công khai — theo Assumptions của spec). Mọi request tới FastAPI backend kèm JWT do Supabase phát hành; backend xác thực chữ ký JWT qua `SUPABASE_JWKS_URL` (dùng `PyJWKClient`), rồi tra bảng `profiles` để lấy `role` (reader/librarian/admin) và áp phân quyền tương ứng (FR-010, FR-026, FR-027, FR-028) bằng FastAPI dependency (`require_role(...)`).
- **Rationale**: Supabase Auth đã có sẵn (biến `.env` gồm `SUPABASE_JWKS_URL` xác nhận hướng này), giải quyết toàn bộ phần khó của auth (hash mật khẩu, gửi OTP email, refresh token) mà không cần tự xây dựng — đúng theo lựa chọn hạ tầng người dùng đã chốt.
- **Alternatives considered**:
  - Tự xây auth (bảng users riêng + JWT tự ký) — bị loại vì trùng lặp công việc Supabase Auth đã làm tốt, tăng rủi ro bảo mật (tự quản lý OTP, reset password).
  - Basic Auth/session cookie phía backend — bị loại vì backend cần stateless để chạy tốt trên Render (auto-scale, nhiều instance), JWT phù hợp hơn session lưu server-side.

## 3. Vai trò & bảng người dùng: một bảng `profiles` dùng chung, phân biệt bằng cột `role`

- **Decision**: Một bảng `profiles` (khóa chính = `id` = `auth.users.id` của Supabase) chứa `role` (enum: `reader` | `librarian` | `admin`), `code` (mã hiển thị, duy nhất theo từng vai trò, ví dụ độc giả `DG00001`, thủ thư `NV00001`, quản trị `QT00001`), `full_name`, `date_of_birth`, và các cột chỉ áp dụng cho Độc giả (`phone`, nullable cho vai trò khác).
- **Rationale**: Cả 3 vai trò đều dùng chung cơ chế đăng nhập của Supabase Auth và đều có Họ tên/Ngày sinh (theo Data Dictionary DE08, DE09 "dùng chung"); một bảng chung với `role` giúp tránh trùng lặp 3 bảng gần như giống nhau, đơn giản hóa việc kiểm tra JWT → role → quyền.
- **Alternatives considered**: 3 bảng riêng (`readers`, `librarians`, `admins`) đúng sát nghĩa với Data Dictionary gốc — bị loại vì tăng độ phức tạp join khi kiểm tra "ai đã tạo/duyệt" (Phiếu mượn.Mã nhân viên, Yêu cầu mở khóa.reviewed_by) mà không mang lại lợi ích rõ ràng cho quy mô nhỏ (~2.000 người dùng). Có thể tách lại sau nếu nghiệp vụ mỗi vai trò phình to khác biệt.

## 4. Kiểm tra "quá hạn/chưa đền bù" (business rule lõi): tính theo yêu cầu (on-the-fly), không dùng cột cache

- **Decision**: Trạng thái "Độc giả có sách quá hạn/chưa đền bù" (dùng ở FR-009, FR-012, FR-020) được tính trực tiếp bằng một query trên `loan_details` (JOIN `loans`) tại thời điểm cần kiểm tra (mượn sách mới, xử lý mở khóa, trả sách), KHÔNG lưu một cột "is_overdue" cache trên `profiles`/`library_cards` cần đồng bộ liên tục.
- **Rationale**: Tránh lớp đồng bộ dữ liệu phái sinh dễ lệch (stale cache) — đúng tinh thần Assumptions của spec ("khóa thẻ tự động... dựa trên kiểm tra Chi tiết phiếu mượn tại các thời điểm giao dịch liên quan"). Với quy mô ~150.000 chi tiết phiếu mượn, một query có index đúng (`loan_details(status)`, `loans(due_date)`) đủ nhanh để đạt Performance Goals đã đề ra.
- **Alternatives considered**: Background job/cron cập nhật cột cache định kỳ — bị loại vì thêm độ trễ (không tức thời) và một nguồn lỗi đồng bộ mới, không cần thiết ở quy mô này.

## 5. Frontend data-fetching & state: TanStack Query + một SPA React duy nhất, route theo role

- **Decision**: TanStack Query cho toàn bộ gọi API tới FastAPI (cache, refetch, trạng thái loading/error nhất quán); React Router v6 với route guard đọc `role` từ JWT (decode phía client hoặc từ context sau khi gọi `/me`) để hiển thị đúng khu vực Reader/Librarian/Admin trong một ứng dụng.
- **Rationale**: Giảm boilerplate quản lý state thủ công cho một app CRUD-nặng (nhiều danh sách/tra cứu: sách, độc giả, phiếu mượn, báo cáo); một SPA giúp tái sử dụng component (bảng, form) giữa các vai trò mà vẫn deploy đơn giản trên Vercel (một build duy nhất).
- **Alternatives considered**: Redux/Zustand cho global state — không cần thiết vì phần lớn state là server-state (TanStack Query đã xử lý tốt); 3 SPA riêng theo vai trò — bị loại vì tăng chi phí bảo trì không tương xứng với lợi ích ở quy mô 3 vai trò.

## 6. Testing & CI cho hai môi trường deploy riêng (Render + Vercel)

- **Decision**: Backend test bằng pytest (unit cho service layer thuần logic + integration dùng DB test thật hoặc container Postgres tạm) chạy trước khi deploy Render. Frontend test bằng Vitest/RTL cho component, Playwright cho E2E các luồng P1, P2, P3, P4, P7 chạy trên preview deployment (Vercel preview URL trỏ tới backend staging trên Render) trước khi merge.
- **Rationale**: Vercel tự tạo preview deployment cho mỗi PR — tận dụng để chạy Playwright E2E thật trước khi vào `main`, phát hiện lỗi tích hợp FE-BE-Supabase sớm.
- **Alternatives considered**: Chỉ test unit, bỏ qua E2E — bị loại vì các quy tắc nghiệp vụ liên-bảng phức tạp (mượn/trả/khóa thẻ) rủi ro cao nếu chỉ test từng lớp riêng lẻ.

## 7. Deployment cụ thể trên Render/Vercel

- **Decision**: Backend (`backend/`) deploy trên Render dạng "Web Service" (Python), start command `uvicorn src.main:app --host 0.0.0.0 --port $PORT`, biến môi trường (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `DATABASE_URL`) khai báo trong Render Dashboard (không commit `.env`). Frontend (`frontend/`) deploy trên Vercel dạng static/Vite build, biến môi trường public (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL` trỏ tới URL backend Render) khai báo trong Vercel Project Settings.
- **Rationale**: Đúng lựa chọn hạ tầng người dùng đã chốt (Vercel cho frontend, Render cho backend); tách biệt secret key (chỉ backend) khỏi publishable key (frontend an toàn để lộ).
- **Alternatives considered**: Deploy backend trên Vercel Serverless Functions — bị loại vì FastAPI + SQLAlchemy async với connection pool phù hợp hơn với một service dài hạn (Render) hơn là serverless cold-start, và người dùng đã chọn Render.
