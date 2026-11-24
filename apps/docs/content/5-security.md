# Security model

- **NGO separation, three layers:** the database client adds the NGO to every query and refuses to run without one; database triggers reject links between NGOs; permissions come from membership in the NGO whose site is being used, never from headers or tokens.
- **Routes are closed by default.** A test fails if any route lacks an access rule.
- **Sessions:** 15-minute access tokens, rotating refresh tokens, replay ends the session, sign-out and suspension apply at once.
- **Passwords:** bcrypt, common passwords refused, lock after ten failures. Two-step codes cannot be reused.
- **Money:** signature and amount are checked with the gateway, every step is idempotent, the ledger is append-only and must balance.
- **Sensitive fields** (PAN, gateway secrets, two-step secrets) are AES-256-GCM encrypted and tied to their NGO.
- **Files** go to private storage, are type-checked and virus-scanned, and are served by short-lived links.
- **Browser:** nonce-based CSP, no third-party scripts except Razorpay checkout, no tracking.

Report a problem privately to the platform operator; please do not open a public issue.
