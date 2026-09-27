# ADR-0004: Authentication approach

- **Status:** Accepted
- **Date:** 2026-09-24

## Context

We need auth that runs in Cloudflare Workers, keeps **identity separate from employment**, supports one
user across many tenants, and can grow into MFA/SSO/SAML/SCIM — without inventing cryptography.

## Decision

Implement a lean, standards-based, **session-oriented** auth in `@hrms/auth`, behind an
`IdentityProvider` interface:

- **Password hashing:** PBKDF2-HMAC-SHA-256 via Web Crypto (`crypto.subtle`), per-user random salt,
  env-tunable iteration count, stored as a **versioned** string `pbkdf2$sha256$<iter>$<saltb64>$<hashb64>`.
  Web Crypto lacks argon2/bcrypt in Workers; PBKDF2 is OWASP-acceptable, and the version prefix lets us
  migrate to argon2id (WASM) or a dedicated hashing Worker later, re-hashing on next login.
- **Sessions:** server-side `sessions` rows; opaque high-entropy token, stored **hashed** (SHA-256) in
  DB. Web sets an `httpOnly`, `Secure`, `SameSite=Lax` cookie; mobile/API use a bearer token. Absolute +
  idle expiry, rotation on privilege elevation and password reset, and full revocation ("logout all").
- **Tenant selection:** the session records an `active_tenant_id`; switching re-validates membership.
- **Abuse controls:** per-account/per-IP rate limiting + lockout, Turnstile on public auth endpoints,
  non-enumerating error messages, `login_audit` trail.

## Alternatives considered

- **better-auth / Lucia / Auth.js:** viable, but impose schema/opinions that fight our multi-tenant
  identity/employment separation and field-level needs. We keep control now; we may adopt **WorkOS**
  (or similar) specifically for enterprise **SSO/SCIM** in Phase 10 behind the same interface.

## Consequences

- We own security-sensitive session code and MUST cover it with tests and keep it minimal/standard.
- No custom crypto primitives — only standard KDFs/hashes from Web Crypto.
- Swapping providers later touches only `@hrms/auth`, not the domain.
