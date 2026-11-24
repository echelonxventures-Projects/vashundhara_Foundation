# Tech Stack Decision Document

## Project: Vashundhara Foundation Platform

### Executive Summary

This document outlines the technology stack selection for building an enterprise-grade, multi-tenant, multi-lingual, multi-currency platform with 100% configurability and dynamic architecture.

---

## Core Requirements Analysis

| Requirement | Implication |
|-------------|-------------|
| **Multi-tenant** | Shared infrastructure, data isolation, tenant-specific configs |
| **Multi-lingual (i18n)** | ICU MessageFormat, RTL support, locale fallback chains |
| **Multi-currency** | Real-time exchange rates, minor unit storage, compliance |
| **100% Configurable** | Feature flags, dynamic schemas, runtime config reload |
| **Fully Dynamic** | Schema-driven UI, headless CMS, page builder |
| **Enterprise Scale** | High availability, audit trails, compliance (PCI, GDPR) |

---

## Technology Stack Selection

### Backend: **NestJS (TypeScript)**

| Criterion | Assessment |
|-----------|------------|
| **Modularity** | ✅ First-class module system, dependency injection |
| **Multi-tenancy** | ✅ Guards, interceptors, middleware for tenant context |
| **GraphQL/REST** | ✅ Apollo integration, code-first schema |
| **Type Safety** | ✅ End-to-end TypeScript with Prisma |
| **Enterprise Features** | ✅ CQRS, Event Sourcing, Microservices support |
| **Ecosystem** | ✅ Rich ecosystem (Swagger, Testing, Config, Schedule) |
| **Team Productivity** | ✅ Angular-like structure, decorators, CLI generators |

**Alternatives Considered:**
- **Express/Fastify**: Too low-level, manual multi-tenancy
- **Spring Boot**: JVM overhead, team expertise in TypeScript
- **Django**: Python not aligned with frontend stack
- **Go (Gin/Fiber)**: Less mature ecosystem for enterprise features

---

### Database: **PostgreSQL + Redis + Elasticsearch**

#### PostgreSQL (Primary)
| Feature | Implementation |
|---------|----------------|
| **Multi-tenancy** | Row Level Security (RLS) + `tenant_id` on all tables |
| **JSONB** | Flexible configs, feature flags, dynamic schemas |
| **Partitioning** | Time-series data (donations, audit logs, events) |
| **Extensions** | `pg_trgm` (search), `uuid-ossp`, `citext` |
| **Replication** | Streaming replication for HA |

#### Redis (Caching & Sessions)
| Use Case | TTL Strategy |
|----------|--------------|
| **Sessions** | 24h sliding, refresh on activity |
| **Tenant Config** | 5min, invalidated on update via pub/sub |
| **Exchange Rates** | 1h, refreshed by cron |
| **Translations** | 10min, fallback to DB |
| **Rate Limiting** | Per-tenant, per-endpoint |

#### Elasticsearch (Search & Analytics)
| Use Case | Index Strategy |
|----------|----------------|
| **Donation Search** | Time-based indices, ILM policy |
| **Audit Logs** | Daily indices, 90-day retention |
| **Full-text Search** | N-gram analyzers for multilingual |
| **Analytics Dashboards** | Pre-aggregated rollups |

---

### Frontend: **Next.js 14+ (App Router) + React 18 + TypeScript**

| Feature | Implementation |
|---------|----------------|
| **Routing** | File-based, `[locale]` segment for i18n |
| **Rendering** | RSC for static, SSR for dynamic, ISR for content |
| **State** | TanStack Query (server), Zustand (client), React Context (theme) |
| **Forms** | React Hook Form + Zod + JSON Schema Forms |
| **UI Library** | shadcn/ui (Radix + Tailwind) - accessible, customizable |
| **i18n** | next-intl with ICU MessageFormat |
| **Theming** | CSS variables + Tailwind config per tenant |
| **Build** | Turbopack (dev), SWC (prod) |

---

### Authentication: **Keycloak (OIDC/SAML)**

| Requirement | Keycloak Feature |
|-------------|------------------|
| **SSO** | OIDC, SAML 2.0, OpenID Connect |
| **Multi-tenancy** | Realms per tenant or shared realm with groups |
| **RBAC** | Realm roles, client roles, composite roles |
| **MFA** | TOTP, WebAuthn, SMS, Email |
| **Social Login** | Google, Microsoft, GitHub, Apple |
| **User Federation** | LDAP, Active Directory, Kerberos |
| **Admin API** | Full CRUD for users, roles, clients |
| **Events** | Login, logout, admin events for audit |

**Why not Auth0/Clerk/NextAuth?**
- **Cost**: Keycloak self-hosted = no per-MAU fees
- **Control**: Full data sovereignty, on-prem option
- **Customization**: SPIs for custom authenticators, mappers
- **Standards**: Pure OIDC/SAML, no vendor lock-in

---

### API Layer: **GraphQL (Apollo) + REST Hybrid**

| Use Case | Protocol |
|----------|----------|
| **Dynamic Queries** | GraphQL (schema-driven UI, flexible fetch) |
| **Webhooks** | REST (standard, firewall-friendly) |
| **File Upload** | REST (multipart, streaming) |
| **Real-time** | GraphQL Subscriptions (WebSocket) |
| **Public API** | REST (OpenAPI/Swagger) |

**GraphQL Advantages for This Project:**
- Schema stitching for multi-tenant schemas
- Persisted queries for performance
- Apollo Federation ready for microservices
- Code generation for frontend types

---

### Message Queue: **RabbitMQ**

| Pattern | Implementation |
|---------|----------------|
| **Commands** | Direct exchange, durable queues |
| **Events** | Topic exchange, dead letter queues |
| **Delayed** | RabbitMQ delayed message plugin |
| **Priority** | Priority queues for donations |
| **DLQ** | Automatic retry with exponential backoff |

**Use Cases:**
- Donation processing (payment, receipt, CRM sync)
- Email/SMS notifications (batched, templated)
- Report generation (async, long-running)
- Exchange rate fetching (scheduled)
- Audit log aggregation

---

### Infrastructure: **Kubernetes (EKS/GKE) + Terraform + ArgoCD**

| Component | Technology |
|-----------|------------|
| **Orchestration** | Kubernetes (managed EKS/GKE) |
| **IaC** | Terraform (modules for VPC, EKS, RDS, ElastiCache) |
| **GitOps** | ArgoCD (app-of-apps pattern) |
| **Service Mesh** | Istio (mTLS, traffic splitting, observability) |
| **Ingress** | NGINX Ingress + cert-manager (Let's Encrypt) |
| **Monitoring** | Prometheus + Grafana + Loki + Tempo |
| **Logging** | Fluent Bit → Loki |
| **Tracing** | OpenTelemetry → Tempo |
| **Secrets** | External Secrets Operator + AWS Secrets Manager |
| **Backup** | Velero (cluster), pgBackRest (PostgreSQL) |

---

### CI/CD: **GitHub Actions**

| Pipeline | Triggers |
|----------|----------|
| **PR Validation** | Lint, typecheck, unit tests, build |
| **Integration** | Main branch, e2e tests, contract tests |
| **Staging Deploy** | Main branch, auto-deploy to staging |
| **Production Deploy** | Tag `v*`, manual approval, blue-green |
| **Dependency Updates** | Weekly, Dependabot PRs |
| **Security Scan** | Daily, Trivy, Snyk, CodeQL |

---

## Architecture Patterns

### 1. Multi-Tenancy: Shared Database, Shared Schema + RLS

```
┌─────────────────────────────────────────────┐
│            PostgreSQL Cluster               │
│  ┌─────────────────────────────────────┐   │
│  │  shared_schema                      │   │
│  │  ├── tenants (RLS disabled)         │   │
│  │  ├── users (RLS enabled)            │   │
│  │  ├── donations (RLS enabled)        │   │
│  │  ├── ...                            │   │
│  │  └── RLS Policies: tenant_id = current_setting('app.current_tenant') │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Tenant Resolution Order:**
1. Subdomain (`tenant.app.com`)
2. Header (`X-Tenant-ID`)
3. JWT claim (`tenant_id`)
4. Path (`/t/tenant-slug/...`)
5. Default (system tenant)

### 2. Configuration System: Centralized with Versioning

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  System Config  │────▶│  Tenant Config  │────▶│  Runtime Cache  │
│  (Defaults)     │     │  (Overrides)    │     │  (Redis)        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   Versioned              Versioned              Pub/Sub Invalidation
   in DB                  in DB                  on Update
```

### 3. Dynamic UI: Schema-Driven Forms

```json
{
  "type": "object",
  "properties": {
    "donationAmount": {
      "type": "number",
      "title": "Donation Amount",
      "ui:widget": "currency",
      "ui:options": { "currency": "{{tenant.defaultCurrency}}" }
    }
  },
  "uiSchema": {
    "donationAmount": {
      "ui:placeholder": "Enter amount",
      "ui:validationMessages": {
        "minimum": "Minimum donation is {{minAmount}}"
      }
    }
  }
}
```

---

## Development Environment

### Local Stack (Docker Compose)
```yaml
services:
  postgres: # Primary DB
  redis:    # Cache & sessions
  rabbitmq: # Message queue
  keycloak: # Auth
  elasticsearch: # Search
  minio:    # S3-compatible storage
  mailhog:  # Email testing
```

### Tooling
| Tool | Purpose |
|------|---------|
| **Turborepo** | Monorepo build orchestration |
| **pnpm** | Fast, disk-efficient package manager |
| **Nx** | Generators, affected commands, graph visualization |
| **Prisma** | Type-safe ORM, migrations, studio |
| **Trivy** | Container vulnerability scanning |
| **Hadolint** | Dockerfile linting |

---

## Decision Matrix Summary

| Layer | Decision | Confidence |
|-------|----------|------------|
| **Backend Framework** | NestJS | High |
| **Primary Database** | PostgreSQL | High |
| **Cache/Sessions** | Redis | High |
| **Search/Analytics** | Elasticsearch | High |
| **Frontend Framework** | Next.js 14+ | High |
| **UI Library** | shadcn/ui + Tailwind | High |
| **Auth Provider** | Keycloak | High |
| **API Style** | GraphQL + REST | High |
| **Message Queue** | RabbitMQ | High |
| **Orchestration** | Kubernetes | High |
| **IaC** | Terraform | High |
| **GitOps** | ArgoCD | High |
| **CI/CD** | GitHub Actions | High |
| **Monorepo Tool** | Turborepo | High |

---

## Next Steps

1. **Initialize Monorepo** - Turborepo + pnpm workspaces
2. **Database Schema** - Prisma schema with RLS policies
3. **Auth Integration** - Keycloak realm setup, OIDC client
4. **Core Modules** - Tenant, User, Config, i18n, Currency
5. **API Foundation** - GraphQL schema, tRPC/REST endpoints
6. **Frontend Shell** - Next.js app, theme system, routing

---

*Document Version: 1.0*
*Last Updated: 2026-11-23*
*Author: Architecture Team*