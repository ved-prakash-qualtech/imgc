# Multi-Tenancy Standards

QCP multi-tenancy backend standards. This document describes the backend patterns that the frontend multitenant template integrates with.

## Overview

QCP multi-tenancy uses a subdomain-based tenant identity model with a central super-admin registry for tenant resolution.

## Tenant identity

Tenant identity is encoded in the Host subdomain:

```
{tenant}-{product}-{env}.domain
```

- `tenant`: tenant short code (e.g., `qc`, `client1`)
- `product`: product identifier (e.g., `app`, `kyc`)
- `env`: environment (e.g., `local`, `dev`, `prod`)
- `admin-*` prefix: superadmin/system scope

**A fourth segment is allowed and is the _location_.** `admin-ibs-uat-onprem` and
`qc-lms-uat-onprem` are the hostnames this estate actually publishes; `onprem` (or `aws`) says
where the estate put the box and nothing about who is asking or what they want. **Only the first
three segments are addressed** — parse them and ignore the rest. Requiring exactly three refuses
every hostname above, and the symptom is distinctive: `/` serves the app while every other route
returns `QT-TEN-403`, because `/` is tenant-excluded and everything else needs a tenant the
parser could not find. Do not express the optional segment as a regex — a quantifier inside a
quantifier trips `security/detect-unsafe-regex`. Split on the dot, then on hyphens, and validate
each segment.

## Registry resolution

The super-admin backend maintains a registry of active tenants:

- Endpoint: `GET /api/v1/tenants/active`
- Authentication: API client token (`X-Client-Id`/`X-Client-Secret`)
- Response: list of tenants with `shortCode`, `backendUrl`, and metadata

Frontend resolves tenant by:

1. Extracting shortCode from Host subdomain
2. Fetching from registry (cached, 5-minute TTL)
3. Deriving tenant backend URL by swapping `admin-` prefix

## Backend URL derivation

Given a super-admin URL like `https://admin-app-prod.qualtechedge.in`:

- Tenant `qc` → `https://qc-app-prod.qualtechedge.in`
- Tenant `client1` → `https://client1-app-prod.qualtechedge.in`

## Tenant-scoped data

All tenant-scoped APIs:

- Accept `x-tenant` header (set by middleware from subdomain)
- Return data filtered to the requesting tenant
- Never accept tenant from body, query, or client headers

## Encryption

Per-tenant encryption uses derived keys:

- Master key: `ENCRYPTION_MASTER_KEY` (64 hex chars, Vault-managed)
- Tenant key: HMAC-SHA256(masterKey, `tenant:{shortCode}`)
- User key: HMAC-SHA256(masterKey, `user:{userId}`)

Encryption format: AES-256-CBC with IV prepended to ciphertext.

## Related

- [Next.js Multitenant Template standards](./nextjs-multitenant-template.md) — Frontend implementation
