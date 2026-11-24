# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vashundhara Foundation** - Enterprise-grade multi-tenant, multi-lingual, multi-currency platform with 100% configurability and dynamic architecture.

## Tech Stack

- **Monorepo**: Turborepo with pnpm workspaces
- **Backend**: NestJS (TypeScript) with Prisma ORM
- **Frontend**: Next.js 14+ (App Router) with React 18, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL (primary), Redis (caching/sessions)
- **Auth**: Better-Auth (modern, framework-agnostic)
- **API**: tRPC for type-safe APIs + REST for webhooks
- **i18n**: next-intl (frontend), custom backend translations
- **Multi-currency**: Custom exchange rate service + Intl.NumberFormat
- **Feature Flags**: Unleash or custom tenant-config system
- **Testing**: Vitest (unit), Playwright (e2e)
- **Deployment**: Docker, Kubernetes (k8s), GitHub Actions CI/CD

## Project Structure

```
vashundhara-foundation/
├── apps/
│   ├── api/              # NestJS backend
│   ├── web/              # Next.js frontend
│   ├── admin/            # Admin dashboard (Next.js)
│   └── docs/             # Documentation site
├── packages/
│   ├── config/           # Shared configuration (ESLint, TS, Tailwind)
│   ├── database/         # Prisma schema, migrations, seed
│   ├── shared/           # Shared types, utilities, constants
│   ├── ui/               # Shared React components (shadcn/ui based)
│   ├── i18n/             # Translation files, i18n utilities
│   ├── auth/             # Auth utilities, types, guards
│   └── feature-flags/    # Feature flag client/server
├── tooling/
│   ├── scripts/          # Build, deploy, migration scripts
│   └── generators/       # Code generators (modules, entities)
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile.*
├── k8s/                  # Kubernetes manifests
├── .github/workflows/    # CI/CD pipelines
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

## Key Commands

### Development
```bash
# Install dependencies
pnpm install

# Run all dev servers
pnpm dev

# Run specific app
pnpm --filter=api dev
pnpm --filter=web dev

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Open Prisma Studio
pnpm db:studio
```

### Building & Testing
```bash
# Build all packages
pnpm build

# Build specific app
pnpm --filter=api build
pnpm --filter=web build

# Run tests
pnpm test              # Unit tests
pnpm test:e2e          # E2E tests
pnpm test:coverage     # Coverage report

# Lint & format
pnpm lint
pnpm format
pnpm typecheck
```

### Database
```bash
# Create migration
pnpm db:migrate:create --name=migration_name

# Deploy migrations (prod)
pnpm db:migrate:deploy

# Reset database (dev only)
pnpm db:reset
```

### Docker
```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all
docker-compose down
```

## Architecture Principles

### Multi-Tenancy
- **Schema-per-tenant** for strong isolation (Prisma middleware)
- Tenant context via subdomain, header, or path
- Shared tables for system-level data (users, roles, permissions)
- Row-level security (RLS) policies where applicable

### Configuration System
- **TenantConfig** entity: JSONB column for flexible settings
- **FeatureFlag** entity: boolean/string/number values per tenant
- **SystemConfig**: Global defaults, overridable per tenant
- Runtime config reload without restart (Redis pub/sub)

### Internationalization (i18n)
- **Locales**: en, hi, bn, ta, te, mr, gu, kn, ml, or, pa, as, ur (13 Indian languages + English)
- **Translation keys**: Namespaced by module (auth, dashboard, billing, etc.)
- **Backend**: Translations stored in DB, cached in Redis
- **Frontend**: next-intl with locale routing (`/[locale]/...`)
- **RTL support**: For Urdu (future)

### Multi-Currency
- **Currency** entity: code, symbol, decimals, locale formatting
- **ExchangeRate** entity: base=USD, daily rates from provider (exchangerate-api.com)
- **Money** value object: amount (minor units), currency code
- **Display**: Intl.NumberFormat with locale-aware formatting
- **Conversion**: Real-time + cached rates, tenant default currency

### Authentication & Authorization
- **Better-Auth** with plugins: organization, two-factor, passkey
- **RBAC**: Role → Permissions → Resources/Actions
- **Multi-tenant roles**: System Admin, Tenant Admin, Manager, Member
- **Session management**: Redis-backed, configurable TTL

## Module Structure (Backend)

Each module follows:
```
src/modules/<module>/
├── <module>.module.ts
├── controllers/
├── services/
├── dto/
├── entities/
├── repositories/
├── guards/
├── interceptors/
└── <module>.controller.spec.ts
```

Core modules: `tenant`, `user`, `auth`, `role`, `permission`, `config`, `i18n`, `currency`, `feature-flag`, `audit`, `notification`, `file`, `webhook`

## Environment Variables

### Required (`.env`)
```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
JWT_SECRET="..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"
EXCHANGE_RATE_API_KEY="..."
```

### Optional
```env
SENTRY_DSN="..."
LOG_LEVEL="debug"
FEATURE_FLAG_PROVIDER="unleash"
```

## Git Workflow

- **Main branch**: `main` (protected)
- **Feature branches**: `feat/<scope>-<description>`
- **Fix branches**: `fix/<scope>-<description>`
- **Chore branches**: `chore/<description>`
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **PR required** for all changes to main

## Key Files to Understand

- `packages/database/prisma/schema.prisma` - Complete data model
- `apps/api/src/main.ts` - App bootstrap, global pipes/guards/interceptors
- `apps/web/middleware.ts` - Locale detection, tenant resolution
- `packages/shared/src/tenant/tenant-context.ts` - Tenant context management
- `packages/config/tailwind/` - Design system tokens

## Adding New Features

1. Create module in `apps/api/src/modules/`
2. Add Prisma models to `packages/database/prisma/schema.prisma`
3. Run `pnpm db:migrate:create`
4. Add tRPC routes in `apps/api/src/trpc/routers/`
5. Add React Query hooks in `packages/shared/src/hooks/`
6. Build UI components in `packages/ui/src/components/`
7. Add translations in `packages/i18n/locales/`
8. Write tests

## Performance Guidelines

- **Database**: Use Prisma `select`/`omit`, avoid N+1 with `include`, batch with `$transaction`
- **Caching**: Redis for sessions, config, exchange rates, translations
- **Frontend**: React Query for server state, Suspense for streaming, dynamic imports
- **API**: Pagination (cursor-based), filtering, sparse fieldsets

## Security Checklist

- [ ] All inputs validated (Zod schemas)
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured per environment
- [ ] Helmet.js headers
- [ ] SQL injection prevention (Prisma parameterized)
- [ ] XSS prevention (React auto-escape, DOMPurify for rich text)
- [ ] Secrets in vault, never in code
- [ ] Audit logging for sensitive operations

## Useful Scripts

```bash
# Generate new module
pnpm generate:module --name=billing

# Generate CRUD for entity
pnpm generate:crud --entity=Invoice --module=billing

# Check for circular dependencies
pnpm depcheck:circular

# Analyze bundle size
pnpm analyze:web
```