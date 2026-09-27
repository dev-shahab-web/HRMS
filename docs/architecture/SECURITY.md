# Security

Follows OWASP ASVS/Top-10 thinking. Security is layered and enforced server-side. This document is
the checklist the codebase is held to; specific mechanisms link to their modules.

## Identity, sessions, secrets

- **Password hashing:** PBKDF2-HMAC-SHA-256 (Web Crypto, Workers-native), per-user random salt,
  high iteration count (env-tunable), versioned hash string (`pbkdf2$sha256$<iter>$<salt>$<hash>`) so
  the algorithm can be upgraded (→ argon2id) without breaking existing users. See ADR-0004.
- **Sessions:** server-side session records; web uses `httpOnly`, `Secure`, `SameSite=Lax` cookies;
  mobile/API use opaque bearer session tokens. Absolute + idle expiry. Rotation on privilege change and
  on password reset. "Logout all devices" revokes all sessions for a user. Login attempts are audited.
- **Brute force / abuse:** per-account + per-IP rate limiting and lockout with backoff; Cloudflare
  Turnstile on signup/login/forgot-password. Generic error messages (no user-enumeration).
- **MFA:** TOTP-ready; enforced-per-tenant policy in later phases.
- **Secrets:** never in the repo. Workers secrets via `wrangler secret`. A `KmsProvider` abstraction
  wraps envelope encryption for application-level field encryption so Cloudflare/AWS/GCP KMS can be
  swapped.

## Authorization & tenancy

- Server-side RBAC + data scopes (`AUTHORIZATION.md`) and tenant isolation (`MULTI_TENANCY.md`).
- Every mutation checks a permission; every sensitive read checks a scope-aware, field-level permission.

## Input / output

- **Validation:** all inputs validated with Zod at the boundary (`@hrms/validation`). Reject unknown
  fields; coerce/parse explicitly. No trusting client-provided ids for authorization.
- **SQL injection:** parameterized queries only (Drizzle / tagged SQL). String-concatenated SQL is
  forbidden.
- **XSS:** React escapes by default; no `dangerouslySetInnerHTML` with untrusted data. User-authored
  rich text (letters/emails) is sanitized and rendered in a constrained context.
- **Template safety:** document/email templates use a **sandboxed** variable interpolation + whitelisted
  helpers — never `eval`/`Function` on tenant-authored content. The payroll formula engine parses to an
  AST with an allow-list of operators/functions (no arbitrary code). See ADR-0005 (formula engine).
- **CSRF:** cookie-auth state-changing requests require a CSRF token / are gated by `SameSite` +
  origin checks. Bearer-token clients are not cookie-based and are not CSRF-susceptible.

## Transport & headers

- HTTPS only (HSTS at the edge). Security headers: `Content-Security-Policy`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy`, `X-Frame-Options`/frame-ancestors, `Permissions-Policy`.
- CORS locked to configured origins (`CORS_ALLOWED_ORIGINS`), credentials handled explicitly.

## Files

- R2 objects private by default; access via short-lived signed URLs issued only after a server-side
  authorization check. Object keys encode tenant/company/employee but key obscurity is never the
  control. Uploads: size limits, MIME sniffing/validation (not just extension), checksum, AV-scan hook
  (interface). Downloads set safe content-disposition and content-type.

## SSRF & outbound

- Outbound webhooks and any URL-fetching validate/deny internal address ranges, follow an allow-list
  where possible, sign payloads (HMAC), and run out-of-band via queues with retries + delivery logs.

## Auditing & logging

- Sensitive mutations write immutable `audit_event` rows (actor/tenant/company/action/entity/before/
  after/requestId/ip/source). **Never** log or audit passwords, tokens, full bank numbers, or raw
  government IDs. PII is masked in logs and excluded from telemetry.
- Structured logs carry `requestId`/`correlationId` but not PII. Error monitoring (Sentry) and tracing
  (OpenTelemetry) via interfaces; PII scrubbed before export.

## Data protection & privacy

- Application-level field encryption for the most sensitive fields (bank details, government IDs)
  via `KmsProvider` envelope encryption; keys never stored beside ciphertext.
- No default background location tracking. Location is captured only on explicit attendance actions or
  configured field-work policies, and is transparent to employees (`docs` privacy note surfaced in-app).
- GDPR-style access/export/erasure workflows and configurable retention (payroll/audit have legal
  retention) are designed for; see `DATA EXPORT` and `RETENTION` in the product docs.

## Idempotency & concurrency (integrity)

- Financial/workflow endpoints require idempotency keys; retries never double-apply.
- Finalize-once operations (payroll lock, offer accept) use transactions + optimistic version columns.

## PR security gates (must pass before merge)

| Gate         | Question |
|--------------|----------|
| Tenancy      | Can another tenant access this? Is there a cross-tenant test? |
| Authorization| Does every mutation check a permission? Sensitive reads a field permission? |
| Entitlement  | Does the API verify subscription access where relevant? |
| Validation   | Are all inputs validated and unknown fields rejected? |
| Audit        | Does each sensitive mutation write an audit event? |
| PII          | Are we sure no secret/PII is logged, audited, or in telemetry? |
| Timezone     | Are date/time assumptions correct (UTC storage, tz-aware calc)? |
| Money        | Are financial values integer-minor-unit / numeric, never float? |

## Not claimed

We do **not** claim SOC 2 / ISO 27001 or that backups exist until they are configured and tested.
Controls above are designed to *support* such efforts later.
