# Changed files

6 file(s) in this bundle.

## security/rateLimit.ts
New file.
Event allowlist + map cap, ban reset, safe retryAfter for zero-refill buckets

## security/auth.ts
New file.
HMAC session tokens and handshake auth middleware

## security/guards.ts
New file.
Fix IP resolution, silent packet drops and sampled logging

## server.ts
New file.
server.ts wired to the security layer, fail-closed origins, no admin UI in prod

## security/__tests__/security.test.ts
New file.
Vitest coverage for buckets, limiters and session tokens

## security/README.md
New file.
Hardening checklist and Redis-backed multi-instance notes
