# Library Management System — Frontend

React + Vite SPA with three role-based areas (Reader / Librarian / Admin). See `../specs/001-library-management/` for the full spec/plan, and `../design-system/library-management-system/` for the visual design system this UI implements.

## Setup

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_API_BASE_URL
npm run dev
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build
- `npm run lint` — oxlint
- `npm run format` — prettier
- `npm run test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E (`tests/e2e/`) — requires a running backend +
  frontend and pre-seeded accounts (see each spec file's header comment for the
  env vars it expects). Point these at a disposable test Supabase project, never
  the team's real one — the specs create real auth users, readers, books, loans.

## Structure

`src/pages/{reader,librarian,admin}/` per role, `src/components/` shared UI,
`src/hooks/` React Query hooks per resource, `src/services/` API + Supabase clients.
