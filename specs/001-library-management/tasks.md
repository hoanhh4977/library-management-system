---

description: "Task list for Library Management System (001-library-management)"
---

# Tasks: Library Management System

**Input**: Design documents from `/specs/001-library-management/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-contracts.md](./contracts/api-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The user explicitly asked to use Playwright for E2E testing of the system, and `plan.md`/`research.md` §6 committed to pytest (backend) + Vitest (frontend) + Playwright (E2E) for the highest-risk multi-table flows (borrow/return, lock/unlock). Test tasks are therefore mandatory for User Stories 1, 2, 3, 6, 7 (the flows named in `quickstart.md` §4–5) and optional-but-recommended elsewhere.

**Organization**: Tasks are grouped by user story (P1–P10, from `spec.md`) so each can be implemented, tested, and demoed independently. `backend/` = FastAPI service, `frontend/` = React SPA (see `plan.md` Project Structure).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: US1–US10, mapped to `spec.md` priorities P1–P10
- Setup/Foundational/Polish tasks carry no `[Story]` label

---

## Phase 1: Setup

**Purpose**: Repo skeleton for both services, matching `plan.md` → Project Structure.

- [X] T001 Create `backend/src/{core,models,schemas,services,api,migrations}` and `backend/tests/{contract,integration,unit}` directory skeleton with empty `__init__.py` files
- [X] T002 [P] Initialize backend Python project: `backend/pyproject.toml` (or `requirements.txt`) with `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `sqlalchemy>=2` (async), `asyncpg`, `alembic`, `pyjwt`, `cryptography`, `python-dotenv`, `pytest`, `pytest-asyncio`, `httpx`; activate with `conda activate library-management` (env already created) before installing
- [X] T003 [P] Create `frontend/` Vite + React + TypeScript project; add `react-router-dom`, `@tanstack/react-query`, `@tanstack/react-table`, `@supabase/supabase-js`, `recharts`, `@phosphor-icons/react`, `tailwindcss`, dev deps `vitest`, `@testing-library/react`, `@playwright/test`
- [X] T004 [P] Configure backend lint/format: `ruff` + `black` config in `backend/pyproject.toml`
- [X] T005 [P] Configure frontend lint/format: `eslint` + `prettier` config in `frontend/.eslintrc.cjs` / `frontend/.prettierrc`
- [X] T006 [P] Wire design tokens from `design-system/library-management-system/MASTER.md` into `frontend/tailwind.config.ts` (colors, `--space-*` scale) and `frontend/src/index.css` (Google Fonts import: Lexend, Source Sans 3, IBM Plex Mono; light/dark `:root` token blocks per MASTER.md)
- [X] T007 [P] Initialize Playwright in `frontend/playwright.config.ts` (baseURL from env, `frontend/tests/e2e/` as test dir) per `quickstart.md` §5
- [X] T008 [P] Add `backend/.env.example` and `frontend/.env.example` documenting required vars from `quickstart.md` §1 (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `DATABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_BASE_URL`)

**Checkpoint**: Both projects install and run a trivial "hello" endpoint/page.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared DB models, auth, and app shells that every user story needs. **MUST complete before any Phase 3+ work.**

- [X] T009 Implement async SQLAlchemy engine/session factory reading `DATABASE_URL` from `.env` in `backend/src/core/db.py`
- [X] T010 Configure Alembic environment (`backend/src/migrations/env.py`, `alembic.ini`) pointed at the engine from T009
- [X] T011 [P] Implement Supabase JWT verification (fetch/cache JWKS from `SUPABASE_JWKS_URL`, verify signature + expiry) in `backend/src/core/security.py`
- [X] T012 [P] Implement `get_current_profile` / `require_role(*roles)` FastAPI dependencies (401 if no/invalid token, 403 if role not permitted) in `backend/src/core/deps.py` (depends on T011)
- [X] T013 [P] Create `Profile` SQLAlchemy model in `backend/src/models/profile.py`: `id` (uuid PK = Supabase `auth.users.id`), `role` (`enum('reader','librarian','admin')`, NOT NULL), `code` (text, "UNIQUE trong phạm vi từng role"), `full_name` (NOT NULL), `date_of_birth` (NOT NULL), `phone` (nullable, "NULL nếu role != reader"), `email` (text, "UNIQUE toàn hệ thống, NOT NULL"), `email_verified_at` (nullable timestamptz), `created_at`
- [X] T014 [P] Create `Book` model in `backend/src/models/book.py`: `id`, `code` (unique), `title`/`author`/`publisher`/`category` (NOT NULL), `quantity` (integer, "CHECK (quantity >= 0)")
- [X] T015 [P] Create `LibraryCard` model in `backend/src/models/library_card.py`: `id`, `code` (unique), `reader_id` (FK → profiles.id, UNIQUE — "đảm bảo 1 thẻ/độc giả"), `issued_at` (date, default today), `issued_by` (FK → profiles.id), `status` (`enum('active','locked')`, default `active`)
- [X] T016 [P] Create `Loan` model in `backend/src/models/loan.py`: `id`, `code` (unique), `reader_id`/`librarian_id` (FK → profiles.id, NOT NULL), `loan_date` (date, default today), `due_date` (date, "due_date >= loan_date"), `renewed` (boolean, default `false`)
- [X] T017 [P] Create `LoanDetail` model in `backend/src/models/loan_detail.py`: composite PK (`loan_id`, `book_id`), `quantity` (integer, "CHECK (quantity > 0)"), `actual_return_date` (nullable date), `status` (`enum('borrowing','returned','pending_compensation','compensated')`, default `borrowing`), `compensation_confirmed_by` (nullable FK → profiles.id), `compensation_confirmed_at` (nullable timestamptz)
- [X] T018 [P] Create `CardUnlockRequest` model in `backend/src/models/card_unlock_request.py`: `id`, `card_id` (FK), `requested_by`/`requested_at`, `status` (`enum('pending','approved','rejected')`, default `pending`), `reviewed_by`/`reviewed_at` (nullable — audit trail per FR-011)
- [X] T019 Generate initial Alembic migration covering T013–T018 in `backend/src/migrations/versions/0001_initial.py` and apply with `alembic upgrade head`
- [X] T020 Implement `GET /api/me` (current profile: role, code, full_name, whether a `library_card` exists + its status) in `backend/src/api/me.py`
- [X] T021 Assemble FastAPI app: router registration, CORS (allow `frontend` origin), exception handlers for the standard `{"detail": ...}` error shape in `backend/src/main.py`
- [X] T022 [P] Implement shared overdue/violation check `reader_has_violation(session, reader_id) -> bool` (query per `data-model.md` "Business rule tính quá hạn": `status='borrowing' AND loans.due_date < today` OR `status='pending_compensation'`) in `backend/src/services/eligibility.py`
- [X] T023 [P] Implement Supabase client wrapper (`signUp`, `verifyOtp`, `signInWithPassword`, `signOut`, session getter) in `frontend/src/services/supabaseClient.ts`
- [X] T024 [P] Implement API client wrapper that attaches `Authorization: Bearer <jwt>` from the Supabase session to every request in `frontend/src/services/apiClient.ts`
- [X] T025 Implement role-based route guard reading `GET /api/me` and redirecting to the Reader/Librarian/Admin shell in `frontend/src/routes/RoleGuard.tsx` (depends on T020, T024)
- [X] T026 [P] Implement shared `StatusBadge` component (all 8 status tokens from `design-system/library-management-system/pages/key-patterns.md` §1) in `frontend/src/components/StatusBadge.tsx`
- [X] T027 [P] Implement Reader top-nav layout (2 tabs, no sidebar) in `frontend/src/components/layouts/ReaderLayout.tsx`
- [X] T028 [P] Implement Librarian/Admin sidebar layout (collapses to top-nav < 1024px) in `frontend/src/components/layouts/StaffLayout.tsx`

**Checkpoint**: `alembic upgrade head` succeeds; `GET /api/me` returns 200 for a valid JWT and 401 without one; frontend shows the correct empty-state layout per role.

---

## Phase 3: User Story 1 - Mượn và trả sách tại quầy (Priority: P1) 🎯 MVP

**Goal**: Librarian can create a Loan for an eligible Reader and record returns, with inventory and status kept correct.

**Independent Test**: Seed a Reader with an `active` card and a Book with `quantity=2`; create a loan for 1 copy → `quantity` becomes 1 and a `loan_detail.status='borrowing'` row exists; record the return → `quantity` back to 2, `status='returned'`.

### Tests for User Story 1

- [X] T029 [P] [US1] Contract test `POST /api/loans` (happy path, 403 wrong role, 409 locked card, 409/partial-fail on insufficient stock) in `backend/tests/contract/test_loans_create.py`
- [X] T030 [P] [US1] Contract test `POST /api/loans/{loan_id}/items/{book_id}/return` in `backend/tests/contract/test_loans_return.py`
- [X] T031 [P] [US1] Integration test: full borrow → partial return → on-time/late flag flow in `backend/tests/integration/test_borrow_return_flow.py`
- [X] T032 [P] [US1] Playwright spec `borrow-return-flow.spec.ts` covering quickstart.md §4 steps 3–5 in `frontend/tests/e2e/borrow-return-flow.spec.ts`

### Implementation for User Story 1

- [X] T033 [US1] Implement `loan_service.create_loan(reader_id, librarian_id, items)` in `backend/src/services/loan_service.py`: reject if card not `active` or `reader_has_violation()` (FR-012); set `due_date = loan_date + 14 days` (FR-013); per item, reject only that item if `quantity requested > books.quantity` (FR-015) while committing the rest in one DB transaction
- [X] T034 [US1] Implement `loan_service.return_item(loan_id, book_id)`: set `actual_return_date=today`, `status='returned'`, increment `books.quantity` by the returned line's `quantity` (FR-017), return an `on_time: bool` flag (`actual_return_date <= loans.due_date`)
- [X] T035 [US1] Implement `POST /api/loans` and `GET /api/loans/{loan_id}` in `backend/src/api/loans.py` (role=librarian for POST; reader restricted to own loan, librarian/admin unrestricted, for GET — per `contracts/api-contracts.md`)
- [X] T036 [US1] Implement `POST /api/loans/{loan_id}/items/{book_id}/return` in `backend/src/api/loans.py`
- [X] T037 [P] [US1] Build "Quầy giao dịch" page shell (reader picker + card status badge + loan-detail table with `StatusBadge`) in `frontend/src/pages/librarian/CounterPage.tsx`
- [X] T038 [US1] Build multi-row "Lập phiếu mượn" form (book combobox w/ debounced search, quantity stepper, add/remove line, per-line error display) per `design-system/.../key-patterns.md` §2 in `frontend/src/components/loans/NewLoanForm.tsx`
- [X] T039 [US1] Wire "Trả sách" action (per loan-detail row) calling the return endpoint with loading/success feedback in `frontend/src/pages/librarian/CounterPage.tsx`

**Checkpoint**: User Story 1 fully functional and independently demoable.

---

## Phase 4: User Story 2 - Đăng ký tài khoản Độc giả và cấp Thẻ thư viện (Priority: P2)

**Goal**: A person can self-register (OTP-verified) as a Reader, and a Librarian can later verify identity in person and issue their one-and-only Library Card.

**Independent Test**: Sign up with a fresh email → account usable for read-only login but no card; Librarian issues a card for that account → card `status='active'`.

### Tests for User Story 2

- [X] T040 [P] [US2] Contract test `POST /api/readers/{reader_id}/card` (happy path, 409 already has a card, 404 unknown reader) in `backend/tests/contract/test_cards_issue.py`
- [X] T041 [P] [US2] Integration test: register (create profile row) → issue card → unique-email rejection in `backend/tests/integration/test_registration_and_card.py`
- [X] T042 [P] [US2] Playwright spec `register-and-issue-card.spec.ts` covering quickstart.md §4 steps 1–2 in `frontend/tests/e2e/register-and-issue-card.spec.ts`

### Implementation for User Story 2

- [X] T043 [US2] Implement `POST /api/auth/complete-registration` — called by the frontend right after Supabase `signUp` + OTP verification succeeds; creates the `profiles` row (`role='reader'`, generates `code`, sets `email_verified_at=now()`); 409 if `email` already has a profile (FR-004) in `backend/src/api/auth.py`
- [X] T044 [US2] Implement `card_service.issue_card(reader_id, librarian_id)`: 404 if no reader profile, 409 if a `library_cards` row already exists for `reader_id` (FR-008), else create with `status='active'`, `issued_by=librarian_id` in `backend/src/services/card_service.py`
- [X] T045 [US2] Implement `POST /api/readers/{reader_id}/card` and `GET /api/readers/{reader_id}` in `backend/src/api/readers.py`
- [X] T046 [P] [US2] Build Reader self-registration page (email/password/full name/DOB/phone form → Supabase `signUp` → OTP entry screen → redirect) in `frontend/src/pages/RegisterPage.tsx`
- [X] T047 [P] [US2] Build Librarian "Độc giả" page: search reader by email/code/name, show card status, "Cấp thẻ" action calling T045 in `frontend/src/pages/librarian/ReadersPage.tsx`

**Checkpoint**: User Stories 1–2 both independently functional; US1 can now be exercised through real self-registered readers instead of only seed data.

---

## Phase 5: User Story 3 - Tra cứu sách theo Tên/Tác giả/Thể loại (Priority: P3)

**Goal**: Anyone logged in (Reader, Librarian, Admin) can search the catalog and see live remaining quantity.

**Independent Test**: Seed 3 books; search by a matching author substring → only matches returned with correct `quantity`; search a non-existent term → "no results" state.

### Tests for User Story 3

- [X] T048 [P] [US3] Contract test `GET /api/books?q=&field=` (match on title/author/category, empty-result case) in `backend/tests/contract/test_books_search.py`
- [X] T049 [P] [US3] Playwright spec `search-books.spec.ts` covering quickstart.md §4 step 3 (search from a Reader account) in `frontend/tests/e2e/search-books.spec.ts`

### Implementation for User Story 3

- [X] T050 [US3] Implement `GET /api/books` with `q`/`field` query params (case-insensitive partial match on title/author/category) in `backend/src/api/books.py`
- [X] T051 [P] [US3] Build shared `BookSearch` component (debounced input + result list showing `title`, `author`, `category`, "còn N") reused by Reader and Librarian pages in `frontend/src/components/books/BookSearch.tsx`
- [X] T052 [US3] Build Reader "Tra cứu sách" page using `BookSearch` in `frontend/src/pages/reader/SearchPage.tsx`

**Checkpoint**: US1–US3 independently functional.

---

## Phase 6: User Story 4 - Xem lịch sử mượn sách (Priority: P4)

**Goal**: A Reader sees their own full loan history (read-only); a Librarian can look up any Reader's history.

**Independent Test**: Seed a reader with 2 past loans (one returned, one still borrowing) → history shows both with correct per-book status; a second reader querying a different `reader_id` gets 403.

### Tests for User Story 4

- [X] T053 [P] [US4] Contract test `GET /api/readers/{reader_id}/loans` (own-reader 200, other-reader 403 for role=reader, librarian/admin unrestricted) in `backend/tests/contract/test_loan_history.py`

### Implementation for User Story 4

- [X] T054 [US4] Implement `GET /api/readers/{reader_id}/loans` (join `loans` + `loan_details`, enforce reader-can-only-see-own via `require_role` + id check — FR-028) in `backend/src/api/readers.py`
- [X] T055 [P] [US4] Build Reader "Lịch sử mượn của tôi" page (list of loans, expandable per-book status via `StatusBadge`) in `frontend/src/pages/reader/HistoryPage.tsx`
- [X] T056 [P] [US4] Build Librarian "tra cứu lịch sử theo độc giả" view inside `ReadersPage.tsx` (reuses the same endpoint) in `frontend/src/pages/librarian/ReadersPage.tsx`

**Checkpoint**: US1–US4 independently functional.

---

## Phase 7: User Story 5 - Gia hạn Phiếu mượn (Priority: P5)

**Goal**: Librarian can renew a loan exactly once, only while it is still within its due date.

**Independent Test**: A loan with `due_date` tomorrow and `renewed=false` → renew succeeds, `due_date += 7 days`, `renewed=true`; renewing again → rejected.

### Tests for User Story 5

- [X] T057 [P] [US5] Unit test for renewal eligibility (`renewed=false` and `due_date >= today` required) in `backend/tests/unit/test_renewal_eligibility.py`
- [X] T058 [P] [US5] Contract test `POST /api/loans/{loan_id}/renew` (happy path, 409 already renewed, 409 overdue) in `backend/tests/contract/test_loans_renew.py`

### Implementation for User Story 5

- [X] T059 [US5] Implement `loan_service.renew_loan(loan_id)`: 409 if `renewed=true` or `due_date < today` (FR-018), else `due_date += 7 days`, `renewed=true` in `backend/src/services/loan_service.py`
- [X] T060 [US5] Implement `POST /api/loans/{loan_id}/renew` in `backend/src/api/loans.py`
- [X] T061 [US5] Add "Gia hạn" row action (disabled + tooltip when not eligible) to the Counter page's loan table in `frontend/src/pages/librarian/CounterPage.tsx`

**Checkpoint**: US1–US5 independently functional.

---

## Phase 8: User Story 6 - Báo mất sách và Đền bù (Priority: P6)

**Goal**: Librarian/Admin can record a lost book and, once compensation is confirmed, close out the incident with an auditable record.

**Independent Test**: Mark a `borrowing` line as lost → `status='pending_compensation'`; confirm compensation → `status='compensated'` with `compensation_confirmed_by`/`_at` set.

### Tests for User Story 6

- [X] T062 [P] [US6] Contract test `POST /api/loans/{loan_id}/items/{book_id}/report-lost` in `backend/tests/contract/test_loans_report_lost.py`
- [X] T063 [P] [US6] Contract test `POST /api/loans/{loan_id}/items/{book_id}/confirm-compensation` (asserts `compensation_confirmed_by`/`_at` are persisted per FR-021) in `backend/tests/contract/test_loans_confirm_compensation.py`
- [X] T064 [P] [US6] Integration test: lost → blocked from borrowing (via `reader_has_violation`) → compensated → borrowing allowed again in `backend/tests/integration/test_lost_and_compensation_flow.py`

### Implementation for User Story 6

- [X] T065 [US6] Implement `loan_service.report_lost(loan_id, book_id)` → `status='pending_compensation'` (FR-019) in `backend/src/services/loan_service.py`
- [X] T066 [US6] Implement `loan_service.confirm_compensation(loan_id, book_id, confirmed_by)` → `status='compensated'`, set `compensation_confirmed_by`/`compensation_confirmed_at=now()` (FR-021 audit trail) in `backend/src/services/loan_service.py`
- [X] T067 [US6] Implement `POST .../report-lost` and `POST .../confirm-compensation` in `backend/src/api/loans.py`
- [X] T068 [US6] Add "Báo mất" / "Xác nhận đền bù" row actions to the Counter page loan table (overflow menu per `key-patterns.md` §1) in `frontend/src/pages/librarian/CounterPage.tsx`

**Checkpoint**: US1–US6 independently functional.

---

## Phase 9: User Story 7 - Khóa và Mở khóa Thẻ thư viện (Priority: P7)

**Goal**: Cards auto-lock when a reader has any overdue/pending-compensation line; only an Admin can unlock, via a Librarian-submitted, auditable request.

**Independent Test**: Force a loan overdue → next transaction touching that reader's card flips it to `locked`; submitting an unlock request while still overdue is rejected; once clear, Librarian requests → Admin approves → card `active` again with `reviewed_by`/`_at` recorded.

### Tests for User Story 7

- [X] T069 [P] [US7] Unit test for `sync_card_lock_status` (locks when `reader_has_violation` true, leaves `active` otherwise, never auto-unlocks) in `backend/tests/unit/test_card_lock_sync.py`
- [X] T070 [P] [US7] Contract test `POST /api/cards/{card_id}/unlock-requests` (409 if still in violation) in `backend/tests/contract/test_unlock_requests_create.py`
- [X] T071 [P] [US7] Contract test `.../approve` and `.../reject` (asserts `reviewed_by`/`reviewed_at` persisted per FR-011) in `backend/tests/contract/test_unlock_requests_review.py`
- [X] T072 [P] [US7] Integration test full cycle: overdue → auto-lock → reject-while-violating → clear violation → request → approve → `active` in `backend/tests/integration/test_lock_unlock_flow.py`
- [X] T073 [P] [US7] Playwright spec `overdue-lock-unlock.spec.ts` covering quickstart.md §4 steps 5–6 in `frontend/tests/e2e/overdue-lock-unlock.spec.ts`

### Implementation for User Story 7

- [X] T074 [US7] Implement `card_service.sync_card_lock_status(reader_id)` using `reader_has_violation` (T022); call it from the end of `return_item`, `report_lost`, and `confirm_compensation` (T034, T065, T066) in `backend/src/services/card_service.py`
- [X] T075 [US7] Implement `card_service.request_unlock(card_id, requested_by)`: 409 if `reader_has_violation` still true or a `pending` request already exists for this card, else create `card_unlock_requests` row in `backend/src/services/card_service.py`
- [X] T076 [US7] Implement `card_service.review_unlock(request_id, decision, reviewed_by)`: on `approve`, set card `status='active'`; always set `reviewed_by`/`reviewed_at=now()` (FR-011) in `backend/src/services/card_service.py`
- [X] T077 [US7] Implement `POST /api/cards/{card_id}/unlock-requests`, `.../approve`, `.../reject` in `backend/src/api/cards.py`
- [X] T078 [US7] Add "Gửi yêu cầu mở khóa" action to Librarian `ReadersPage.tsx` (disabled + reason shown when still in violation)
- [X] T079 [US7] Build Admin "Yêu cầu mở khóa thẻ" page (pending list + Approve/Reject actions, badge count in sidebar nav item) in `frontend/src/pages/admin/UnlockRequestsPage.tsx`

**Checkpoint**: US1–US7 independently functional — this closes out every P1–P7 flow named in `quickstart.md`.

---

## Phase 10: User Story 8 - Quản lý danh mục Sách (Priority: P8)

**Goal**: Admin can add and update Book records.

**Independent Test**: Add a new book → immediately findable via US3 search; update its `quantity` → search reflects the new number.

### Tests for User Story 8

- [X] T080 [P] [US8] Contract test `POST /api/books` and `PATCH /api/books/{book_id}` (rejects negative `quantity` per "CHECK (quantity >= 0)") in `backend/tests/contract/test_books_admin.py`

### Implementation for User Story 8

- [X] T081 [US8] Implement `POST /api/books` and `PATCH /api/books/{book_id}` (role=admin) in `backend/src/api/books.py`
- [X] T082 [US8] Build Admin "Quản lý Sách" page (searchable `DataTable` + add/edit dialog form) in `frontend/src/pages/admin/BooksPage.tsx`

**Checkpoint**: US1–US8 independently functional.

---

## Phase 11: User Story 9 - Báo cáo thống kê tồn kho (Priority: P9)

**Goal**: Admin sees an on-demand inventory report: per-book and system-wide totals.

**Independent Test**: With known seed data (books + a mix of borrowing/returned loan details), the report's per-book and aggregate numbers match a hand-computed expectation.

### Tests for User Story 9

- [X] T083 [P] [US9] Unit test for inventory aggregation (`total`, `borrowing`, `remaining` per book + system totals) in `backend/tests/unit/test_inventory_report.py`
- [X] T084 [P] [US9] Contract test `GET /api/reports/inventory` (role=admin only) in `backend/tests/contract/test_reports_inventory.py`

### Implementation for User Story 9

- [X] T085 [US9] Implement `report_service.inventory_report()` (per-book `total`/`borrowing`/`remaining` + system totals, on-demand per `research.md` §7) in `backend/src/services/report_service.py`
- [X] T086 [US9] Implement `GET /api/reports/inventory` in `backend/src/api/reports.py`
- [X] T087 [US9] Build Admin "Tổng quan tồn kho" dashboard (3 stat tiles + top-10 horizontal bar chart with an accessible data-table fallback, per `key-patterns.md` §3) in `frontend/src/pages/admin/DashboardPage.tsx`

**Checkpoint**: US1–US9 independently functional.

---

## Phase 12: User Story 10 - Quản lý Độc giả và Nhân viên thủ thư (Priority: P10)

**Goal**: Admin can view/update Reader and Librarian records.

**Independent Test**: Edit a Reader's phone number as Admin → change is visible in the Librarian's reader lookup (US2/US4).

### Tests for User Story 10

- [X] T088 [P] [US10] Contract test `GET /api/readers`, `PATCH /api/readers/{id}`, `GET /api/librarians`, `PATCH /api/librarians/{id}` (role=admin only) in `backend/tests/contract/test_admin_people.py`

### Implementation for User Story 10

- [X] T089 [US10] Implement `GET /api/readers` (list) and `PATCH /api/readers/{reader_id}` in `backend/src/api/readers.py`
- [X] T090 [US10] Implement `GET /api/librarians` and `PATCH /api/librarians/{librarian_id}` in `backend/src/api/librarians.py`
- [X] T091 [US10] Build Admin "Quản lý Độc giả & Nhân viên" page (two tabs, each a searchable `DataTable` + edit dialog) in `frontend/src/pages/admin/PeoplePage.tsx`

**Checkpoint**: All 10 user stories independently functional.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story hardening before calling the feature done.

- [ ] T092 [P] Run the full `quickstart.md` §4 scenario end-to-end on a local stack (steps 1–7) and fix any gaps found
- [X] T093 [P] Accessibility pass against `design-system/library-management-system/MASTER.md` Pre-Delivery Checklist (contrast, focus rings, `aria-hidden`/`aria-label` on all `StatusBadge`/icon-only buttons) across Reader/Librarian/Admin pages
- [X] T094 [P] Add `backend/tests/unit/test_eligibility.py` edge cases from spec.md Edge Cases (partial returns leaving one line overdue still locks the card; multiple overdue loans across different loan records all counted)
- [X] T095 Add structured request logging (method, path, role, status code, latency) in `backend/src/core/logging.py`, wired into `main.py`
- [X] T096 [P] Write `backend/README.md` and `frontend/README.md` covering local setup, matching `quickstart.md`
- [X] T097 [P] Add `render.yaml` (backend service definition) at repo root and `frontend/vercel.json` per `quickstart.md` §6
- [X] T098 Run full test suite (`pytest`, `npm run test`, `npx playwright test`) and fix any failures before marking the feature done

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories** — every story reads/writes the models and auth built here.
- **User Stories (Phase 3–12)**: All depend on Foundational. Priority order (P1→P10) is the recommended sequential path; independence notes below say what can run in parallel instead.
- **Polish (Phase 13)**: Depends on whichever user stories are in scope for the release.

### User Story Dependencies

- **US1 (P1)**: Foundational only.
- **US2 (P2)**: Foundational only. Not required for US1 (US1's independent test uses seeded readers/cards), but US1 becomes end-to-end real once US2 exists.
- **US3 (P3)**: Foundational only.
- **US4 (P4)**: Foundational + reads data produced by US1 (needs at least one loan to show something, but the endpoint/page can be built and tested with seeded data independent of US1's code).
- **US5 (P5)**: Foundational + extends the `Loan` touched by US1 (same `loan_service.py` file — sequence after US1 to avoid merge conflicts, though logically independent).
- **US6 (P6)**: Foundational + extends `loan_service.py` (same file as US1/US5 — sequence after those).
- **US7 (P7)**: Foundational + calls into US1/US6's service functions (T034, T065, T066) from T074 — must follow US1 and US6.
- **US8 (P8)**: Foundational only (the `Book` model already exists from Phase 2; US8 only adds write endpoints).
- **US9 (P9)**: Foundational + reads data shaped by US1/US8 to be meaningful, but the report code itself has no code dependency on their files.
- **US10 (P10)**: Foundational only.

### Parallel Opportunities

- All `[P]` tasks within Phase 1 and Phase 2 (T002–T008, T013–T018, T022–T028 respectively) touch different files and can run together.
- US3, US8, US9, US10 have no shared-file conflicts with US1/US5/US6/US7's `loan_service.py`/`card_service.py` chain — a second contributor can take these while the first works the loan/card chain.
- All test tasks marked `[P]` inside one story phase can run together (different test files).

---

## Parallel Example: Foundational Models (Phase 2)

```bash
Task: "Create Profile model in backend/src/models/profile.py"
Task: "Create Book model in backend/src/models/book.py"
Task: "Create LibraryCard model in backend/src/models/library_card.py"
Task: "Create Loan model in backend/src/models/loan.py"
Task: "Create LoanDetail model in backend/src/models/loan_detail.py"
Task: "Create CardUnlockRequest model in backend/src/models/card_unlock_request.py"
```

## Parallel Example: User Story 1 Tests

```bash
Task: "Contract test POST /api/loans in backend/tests/contract/test_loans_create.py"
Task: "Contract test POST /api/loans/{loan_id}/items/{book_id}/return in backend/tests/contract/test_loans_return.py"
Task: "Integration test borrow→return flow in backend/tests/integration/test_borrow_return_flow.py"
Task: "Playwright spec borrow-return-flow.spec.ts in frontend/tests/e2e/borrow-return-flow.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. **STOP and VALIDATE**: run T029–T032, then the quickstart.md §4 step-4 scenario by hand against seeded data.
3. This is a demoable MVP: a librarian can borrow and return books for a pre-seeded reader, with correct inventory and status.

### Incremental Delivery (recommended full path)

1. Setup + Foundational → foundation ready.
2. US1 (borrow/return) → demo with seed data.
3. US2 (self-registration + card issuance) → US1 now works with real, self-registered readers.
4. US3 (search) → readers/librarians can find books instead of only using known codes.
5. US4 (history) → visibility into past activity.
6. US5 (renew) → the one-time renewal rule.
7. US6 (lost/compensation) → the exception path.
8. US7 (lock/unlock) → closes the risk-control loop opened by US1/US6; this is also the last story `quickstart.md` exercises end-to-end.
9. US8, US9, US10 (admin catalog/report/people management) → round out the Admin surface; any order among these three is fine.
10. Phase 13 (Polish) → accessibility, logging, deploy config, full-suite run.

### Suggested Team Split (if parallel capacity exists)

- **Track A** (core transactions, sequential — shares `loan_service.py`/`card_service.py`): US1 → US5 → US6 → US7.
- **Track B** (independent, can start right after Foundational): US2, US3, US8, US10.
- **Track C** (independent, can start right after Foundational, light dependency on Track A's data existing for a meaningful demo): US4, US9.

---

## Notes

- `[P]` tasks touch different files with no unmet dependency — safe to hand to parallel agents/developers.
- Every mutating endpoint task should return the standard error shape from `contracts/api-contracts.md` (`{"detail": "..."}`, 400/401/403/404/409).
- Commit after each task or logical group; stop at any phase checkpoint to demo that story independently.
- Constraint strings quoted from `data-model.md` in task descriptions above (e.g. `"CHECK (quantity >= 0)"`) are verbatim — implement them exactly, don't loosen or reinterpret them.
