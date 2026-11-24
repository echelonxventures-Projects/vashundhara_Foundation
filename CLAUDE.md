# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vashundhara Foundation** - Enterprise-grade multi-tenant, multi-lingual, multi-currency platform with 100% configurability and dynamic architecture.

## Tech Stack

- pnpm 10 workspaces, Turborepo, Node 22, TypeScript 5.9
- API: NestJS 11, Prisma 6, PostgreSQL 16, Redis 7, zod 4 (REST under `/api/v1`)
- Web: Next.js 15 (App Router), React 19, Tailwind 3, next-intl 4
- Tests: Vitest (unit and API end-to-end), Playwright with axe (browser)

## Layout

- `apps/api` API and background worker; `apps/web` public site, accounts and staff area; `apps/admin` platform console; `apps/docs` guide
- `packages/database` schema, migrations, seed; `packages/shared` permissions, money, fiscal year; `packages/auth` password, TOTP, encryption; `packages/ui` browser API client and components; `packages/i18n` languages; `packages/feature-flags`

## Commands

`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:migrate:deploy`, `pnpm db:seed`, `pnpm db:create-admin`, `pnpm generate:module <model>`. End-to-end tests need `TEST_DATABASE_URL` with `test` in the database name; they wipe it.

## Rules that keep tenants apart

- Never pass `tenantId` from a request. `common/prisma/tenant-scope.ts` adds it, and throws when there is no NGO in context.
- `runAsSystem` turns scoping off. Use it only for login, tenant lookup, workers and the platform console, and audit what it changes.
- Raw SQL is not scoped: always filter on `"tenantId"`.
- A migration that adds tables must end with `CALL install_tenant_checks();`.
- Every route needs `@Public`, `@SelfService`, `@Can` or `@PlatformAdmin`. `@SelfService` handlers may only touch the signed-in user's own rows.
- Permissions and built-in roles live only in `packages/shared/src/permissions.ts`.

## Other conventions

- Money is BigInt minor units in the database and whole numbers in JSON.
- Use `crudController` for ordinary records. Its schemas must not use `.default()`.
- Side effects (email, webhooks, scans) go through `JobsService.enqueue` with the transaction client.
- Changing money code: keep the row lock, the idempotency check and the balanced journal, and extend `test/money.e2e.ts`.
- User-facing text on public and account pages goes in `packages/i18n/locales`; English and Hindi must be complete.

## Git

Branches `feat/`, `fix/`, `chore/`; conventional commits; pull requests into the main branch.
