# Operations

## Before going live

- DNS: the root domain, `admin`, `api`, `docs` and a wildcard `*` record, with a wildcard certificate (DNS-01).
- Secrets in your secret manager: see `k8s/secrets.example.yaml`. `ENCRYPTION_KEY` protects PAN numbers, gateway keys and two-step secrets. **If it is lost they cannot be recovered**, so keep an offline copy.
- Managed PostgreSQL with point-in-time recovery, Redis with `noeviction`, and a private S3 bucket whose CORS rule allows POST from your sites.
- An SMTP service with SPF, DKIM and DMARC. MSG91 needs DLT-registered templates.
- Restore a backup into an empty database and sign in, before launch and every quarter.
- An independent penetration test.

## Deploy

`kubectl apply -k k8s/overlays/production`. The `migrate` job runs migrations and reference data first. Roll back by applying the previous image tag; migrations only add, so old code keeps working.

## Watch

`/health/ready` checks the database and Redis. `/metrics` (bearer `METRICS_TOKEN`) has request latency and job counts. Alert on: any `DEAD` job, 5xx above 1%, p95 above 1s, backup job failure, certificate expiry.

## Common problems

- **Donation stuck on pending:** check Razorpay's webhook log, then Console, Jobs. Re-sending a webhook is safe.
- **Email not arriving:** Console, Jobs, status DEAD, type `notification.send`.
- **Lost two-step device:** confirm identity offline, then clear two-step in the database with a second person present, and record it.

## Moving the WordPress site

`pnpm import:wordpress <file.wpress> <output folder>` unpacks published pages, posts and media and writes `redirects.csv`. It deliberately skips users, comments, orders and form entries. Review the result, then publish in Pages and Old links.
