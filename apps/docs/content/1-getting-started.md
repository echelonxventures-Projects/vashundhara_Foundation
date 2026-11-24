# Getting started

## Run it on your computer

You need Node 22, pnpm 10, PostgreSQL 16 and Redis 7 (or Docker for the last two).

```
cp .env.example .env            # then fill in the values marked REQUIRED
pnpm install
pnpm build                      # builds packages and generates the database client
pnpm db:migrate:deploy
pnpm db:seed
ADMIN_EMAIL=you@example.org ADMIN_PASSWORD='...' pnpm db:create-admin
pnpm dev
```

| App | Address |
|---|---|
| Public site, accounts and staff area | http://localhost:3001 |
| API (docs at /api/docs, development only) | http://localhost:3000 |
| Platform console | http://localhost:3002 |
| This guide | http://localhost:3003 |

In development email is printed in the API console, and the test payment gateway can be chosen under Staff, Legal and payments.

## Tests

```
pnpm test        # unit tests
TEST_DATABASE_URL=postgresql://localhost/ngo_test pnpm --filter @vashundhara-foundation/api test:e2e
TEST_DATABASE_URL=postgresql://localhost/ngo_test pnpm --filter @vashundhara-foundation/web test:e2e
```

The test database is wiped on every run, so its name must contain `test`.
