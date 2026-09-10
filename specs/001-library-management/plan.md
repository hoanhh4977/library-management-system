# Implementation Plan: Library Management System

**Branch**: `001-library-management` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-library-management/spec.md`

## Summary

Xây dựng hệ thống quản lý thư viện full-stack: backend Python **FastAPI** (REST API, business rules, kiểm soát quyền), frontend **React** (SPA, giao diện phân theo vai trò Độc giả/Nhân viên thủ thư/Quản trị viên), dữ liệu lưu trên **Supabase Postgres**. Supabase Auth đảm nhiệm việc đăng ký/đăng nhập + xác thực Email bằng OTP cho Độc giả (FR-004/FR-005); FastAPI xác thực JWT do Supabase phát hành (qua JWKS) và tự áp các quy tắc nghiệp vụ (mượn/trả, gia hạn, khóa/mở khóa thẻ, đền bù, audit trail) trên một schema Postgres quan hệ ánh xạ đúng Data Dictionary + ERD đã có trong `docs/`. Frontend deploy trên **Vercel**, backend deploy trên **Render** (theo lựa chọn của người dùng).

## Technical Context

**Language/Version**: Backend: Python 3.11+. Frontend: TypeScript 5.x trên React 18+ (build bằng Vite).

**Primary Dependencies**:
- Backend: FastAPI, Pydantic v2, Uvicorn (ASGI server), SQLAlchemy 2.0 (async) + asyncpg (truy cập trực tiếp Postgres của Supabase qua `DATABASE_URL`), Alembic (migrations), PyJWT/python-jose + `PyJWKClient` (xác thực JWT bằng `SUPABASE_JWKS_URL`), passlib không cần dùng (mật khẩu do Supabase Auth quản lý), pytest + httpx (test).
- Frontend: React Router v6, TanStack Query (data fetching/caching), Tailwind CSS + shadcn/ui-style components (theo skill `ui-styling`/`ui-ux-pro-max` đã có sẵn), `@supabase/supabase-js` (chỉ dùng cho luồng Auth: đăng ký/đăng nhập/OTP), axios/fetch wrapper gọi FastAPI backend, Vitest + React Testing Library, Playwright (E2E — skill đã có sẵn trong `.claude/skills`).

**Storage**: Supabase Postgres. Kết nối qua các biến đã có trong `.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (dùng ở frontend cho Supabase Auth), `SUPABASE_SECRET_KEY` (dùng ở backend, không bao giờ lộ ra frontend), `SUPABASE_JWKS_URL` (backend dùng để xác thực JWT). Backend truy cập dữ liệu nghiệp vụ trực tiếp qua kết nối Postgres (SQLAlchemy async), không qua PostgREST, để đảm bảo các quy tắc nghiệp vụ nhiều-bảng (trừ tồn kho + tạo phiếu mượn + chi tiết phiếu mượn trong một transaction) được thực thi tập trung và nhất quán.

**Testing**: Backend: pytest (unit cho business rules — mượn/trả/gia hạn/khóa thẻ/đền bù; integration/contract cho từng endpoint dùng httpx AsyncClient + DB test). Frontend: Vitest + React Testing Library (component/unit). End-to-end: Playwright cho các luồng chính (User Story 1, 2, 3, 4, 7) chạy trên môi trường staging trước khi coi feature "Done".

**Target Platform**: Web (trình duyệt hiện đại). Backend chạy như một Linux web service (Render — Uvicorn/Gunicorn worker), stateless (không lưu session trong bộ nhớ tiến trình, toàn bộ trạng thái xác thực nằm trong JWT do Supabase phát hành) để phù hợp với auto-scaling/redeploy của Render. Frontend build tĩnh (Vite) deploy trên Vercel.

**Project Type**: Web application (frontend + backend riêng biệt) → dùng cấu trúc Option 2 (`backend/` + `frontend/`).

**Performance Goals**:
- API cho các thao tác CRUD/tra cứu thông thường (sách, độc giả, phiếu mượn): p95 < 300ms ở tải dự kiến.
- Tra cứu sách (FR-003) trả kết quả trong < 1s với kho tới ~10.000 đầu sách (khớp SC-002).
- Báo cáo tồn kho (FR-024) tính toán on-demand trong < 2s với quy mô dữ liệu ước tính (xem Scale/Scope).

**Constraints**:
- Không lộ `SUPABASE_SECRET_KEY` ra frontend; frontend chỉ dùng `SUPABASE_PUBLISHABLE_KEY` cho luồng Auth.
- Backend PHẢI xác thực JWT (qua `SUPABASE_JWKS_URL`) trên mọi endpoint yêu cầu đăng nhập, và áp đúng phân quyền theo vai trò (Độc giả chỉ đọc — FR-027/FR-028; Thủ thư không tự mở khóa thẻ — FR-010; chỉ Admin phê duyệt mở khóa/xem báo cáo).
- Backend stateless để tương thích Render (không dùng session lưu trong RAM/tệp cục bộ).
- Các thao tác ảnh hưởng tồn kho + phiếu mượn/chi tiết phiếu mượn PHẢI thực thi trong một transaction DB để tránh lệch số liệu (Edge Case tồn kho).

**Scale/Scope**: Quy mô nhỏ-vừa theo ước tính gốc trong `docs/Data Dict _ Process Spec.pdf`: tối đa ~2.000 Độc giả (tăng ~5%/năm), tối đa ~50.000 Phiếu mượn/năm (~15.000 trung bình), tối đa ~150.000 Chi tiết phiếu mượn (tăng ~10-12%/năm); số đầu Sách chưa xác định cụ thể nhưng giả định vài nghìn đầu. 10 user stories (P1–P10) như đã mô tả trong spec; ưu tiên MVP là P1–P4 (mượn/trả, đăng ký + cấp thẻ, tra cứu, lịch sử).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` hiện vẫn là **template chưa được điền** (không có nguyên tắc cụ thể nào được ratify cho dự án này). Do đó **không có gate cụ thể nào để đối chiếu** ở bước này — mục này được coi là **PASS (N/A)** một cách tường minh, không phải bỏ qua ngầm.

Khuyến nghị: chạy `/speckit-constitution` trước `/speckit-implement` để thiết lập các nguyên tắc dự án (ví dụ: test-first, giới hạn độ phức tạp, chuẩn bảo mật) nếu người dùng muốn có gate thật sự cho các feature sau. Kế hoạch hiện tại tự áp một số nguyên tắc hợp lý mặc định (xem Constraints ở trên: transaction toàn vẹn dữ liệu, không lộ secret key, backend stateless) dù chưa được ratify chính thức.

*Re-check sau Phase 1*: Không phát sinh vi phạm nào cần biện minh — thiết kế ở Phase 1 (data-model, contracts) tuân theo đúng các Constraints đã liệt kê trên. Xem [Complexity Tracking](#complexity-tracking) — để trống vì không có vi phạm.

## Project Structure

### Documentation (this feature)

```text
specs/001-library-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── api-contracts.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── core/             # config (.env loading), db session, security (JWT/JWKS verify, role guard)
│   ├── models/           # SQLAlchemy models: Book, Profile (reader/librarian/admin), LibraryCard,
│   │                     # Loan, LoanDetail, CardUnlockRequest
│   ├── schemas/           # Pydantic request/response schemas per resource
│   ├── services/         # business rules: loan_service, card_service, book_service, report_service
│   ├── api/               # FastAPI routers: books, readers, cards, loans, unlock-requests, reports, admin
│   ├── migrations/       # Alembic migration scripts
│   └── main.py           # FastAPI app entrypoint
└── tests/
    ├── contract/         # per-endpoint request/response contract tests
    ├── integration/      # multi-step business flow tests (borrow→return, lock→unlock, lost→compensate)
    └── unit/             # pure business-rule unit tests (due date calc, renewal eligibility, lock condition)

frontend/
├── src/
│   ├── components/       # shared UI (tables, forms, modals, role-guarded route wrapper)
│   ├── pages/
│   │   ├── reader/        # book search, own loan history (read-only)
│   │   ├── librarian/     # register reader, issue card, borrow/return/renew/lost/compensate, lookup history
│   │   └── admin/          # book CRUD, unlock approvals, reports, manage readers/librarians
│   ├── services/          # api client (fetch/axios wrapper), supabase client (auth only)
│   ├── routes/            # role-based route guards
│   └── App.tsx
└── tests/
    ├── unit/              # Vitest + React Testing Library
    └── e2e/               # Playwright specs for P1-P4, P7 flows
```

**Structure Decision**: Dùng cấu trúc Web application (Option 2): một service backend FastAPI (`backend/`) và một SPA React (`frontend/`) tại repo root, tách biệt hoàn toàn để deploy độc lập (Render cho `backend/`, Vercel cho `frontend/`). Trong `frontend/`, dùng **một** ứng dụng React duy nhất với routing phân theo vai trò (route guard đọc role từ JWT) thay vì 3 app riêng — vì chỉ có 3 vai trò, nhiều thành phần UI dùng chung (bảng danh sách sách, chi tiết phiếu mượn), và giữ một codebase giúp giảm trùng lặp.

## Complexity Tracking

> Không có vi phạm Constitution Check cần biện minh (xem mục Constitution Check trên) — bảng này để trống.
