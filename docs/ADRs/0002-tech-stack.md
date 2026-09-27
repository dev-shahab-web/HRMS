# ADR-0002: Technology stack & monorepo strategy

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

We need a stack that is Cloudflare-first, portable, strongly typed, testable, and able to serve web +
mobile + platform-admin from one API and one domain layer, at SaaS scale.

## Decision

- **Monorepo:** pnpm workspaces + Turborepo. **Internal-source packages** (libraries export
  `./src/index.ts`; apps bundle them) — no per-lib build step; TS resolves types via pnpm symlinks +
  `exports` with `moduleResolution: bundler`.
- **Language:** TypeScript (strict; current major = 7.x) everywhere.
- **API:** Hono on Cloudflare Workers; REST, versioned (`/api/v1`), OpenAPI, Zod validation.
- **DB:** PostgreSQL via Drizzle ORM; Hyperdrive fronts Postgres from Workers. Local/test via PGlite.
- **Web:** React + React Router (full-stack) + Vite on Workers; Tailwind; TanStack Query/Table; RHF+Zod.
- **Mobile:** Expo / React Native (single codebase, Android+iOS), Expo Router, EAS.
- **Async:** Cloudflare Queues (jobs) + Workflows (durable processes).
- **Files:** R2 (private + signed access). **Cache/config:** KV (never source of truth).
- **Tests:** Vitest (unit/integration) + PGlite; Playwright (web E2E); ARTEMIS/device tests for mobile.

## Consequences

- Bleeding-edge majors (TS 7, ESLint 10, Zod 4) are used because they are current-stable; pinned and
  validated by typecheck/CI. If a specific tool lags compatibility, we pin a known-good minor and note it.
- Not sharing DOM components between React and React Native is intentional — we share design language,
  tokens, types, validation, and business logic, not rendering components.
- Workers runtime constrains dependencies to Web-API/Workers-compatible libraries (see `CLAUDE.md` §15–16).
