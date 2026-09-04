# IMGC Lender Portal

A two-role portal for working mortgage-guarantee **initial claims** — document collection, PAS
accounting values, a complete audit trail, stakeholder notifications, and an IMGC/Lender
processing-bucket workflow.

Built on the QCP multitenant Next.js template (Next.js 16 · React 19 · TypeScript 5 strict ·
Tailwind CSS 4 · pnpm 11 · Node ≥ 24.17).

> **Prototype.** Every backend is a stand-in: there is no real PAS, identity provider or SMTP.
> Data lives in a JSON file and uploaded documents on local disk. See
> [Replacing the stand-ins](#replacing-the-stand-ins).

---

## Running it

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The dev script runs plain HTTP on localhost when `DEV_HTTPS=false`
is set in `.env`; drop that flag and it runs HTTPS via mkcert instead (needs an interactive
terminal once, to install the local root CA).

### Signing in

| Role       | How                                                                              |
| ---------- | -------------------------------------------------------------------------------- |
| **IMGC**   | Employee ID + password — seeded as `EMP-0001` / `imgc@123` (also `-0002`, `-0003`) |
| **Lender** | Work email + a one-time code, e.g. `arjun@acme-bank.com`                          |

No mail is delivered, so the lender's code is printed to the server console and recorded on the
**Notifications** page. The sign-in card also has **Demo as IMGC** / **Demo as Lender** buttons.

---

## The two roles

**Scope is decided at sign-in from the identity itself, never from anything the browser sends.**
IMGC staff see the complete pool. A lender sees exactly the accounts whose lender matches the
**domain of their verified email address** — one rule, applied in
`src/services/portal/accounts.server.ts`, and the reason a lender asking for another lender's
account gets a 404 rather than a 403.

| Capability                     | IMGC | Lender |
| ------------------------------ | :--: | :----: |
| See the whole account pool     |  ✅  |   —    |
| Upload claim documents         |  —   |   ✅   |
| Save / Save & Submit a claim   |  —   |   ✅   |
| Accept or reject a document    |  ✅  |   —    |
| Add a document requirement     |  ✅  |   —    |
| Move an account between buckets|  ✅  |   —    |
| Record approved / queried      |  ✅  |   —    |
| Approve a reinstatement        |  ✅  |   —    |
| Grant lender access            |  ✅  |   —    |
| Pull from / update PAS         |  ✅  |   ✅   |
| Remarks and audit trail        |  ✅  |   ✅   |

Route access is enforced by the shell, not by hiding links: `PortalShell` hands `DashboardShell`
the nav the role was granted, and an `activeKey` the nav does not contain calls `forbidden()`.

---

## What each screen does

- **Dashboard** — a command band of headline figures, then in-progress case tiles, portfolio
  rings, actionable items and an aging breakdown. Every number is derived from real rows.
- **Accounts** — the scoped pool, searchable and filterable by bucket and claim status.
- **Account workspace** — five tabs:
  - _Overview_ — the account's facts; IMGC records the processing outcome here (approved /
    queried), because the processing itself happens in PAS.
  - _Accounting Values_ — pulled from PAS; an edit is written **back to PAS** and audited.
  - _Initial Claims_ — the document checklist. Pending → Uploaded → Accepted/Rejected, per-row
    remarks, version history, and **Save · Save & Submit · Cancel**, where Submit unlocks only
    once every mandatory document is in.
  - _Remarks_ — account-level thread, both sides.
  - _Audit Trail_ — every upload, decision, remark and PAS write, filterable.
- **Processing Buckets** (IMGC) — move an account between the IMGC and Lender buckets; each move
  notifies the lender's stakeholders, every IMGC mailbox, and any extra recipients pinned to the
  account.
- **Notifications** — the outbox: what the portal would have emailed.
- **Lender Access** (IMGC) — grant a lender their first sign-in; the email domain decides what
  they will see.
- **Document Retention** (IMGC) — rejected documents are kept **90 days** so they can be
  reinstated with approval, then purged. A reinstatement request holds the clock.

---

## Layout

```
src/
  app/[locale]/
    login/                     sign-in (identifier-driven: Employee ID → password, email → OTP)
    (portal)/
      dashboard/  accounts/  buckets/  notifications/  admin/{users,retention}/
  components/portal/           CommandBand, Panel, StatusPill, Donut, PortalShell
  lib/auth/                    appSession (signed cookie), otp, password
  server/mock/                 db · seed · pas · mailer · retention   ← the stand-ins
  services/portal/             accounts · claims · pas · remarks · audit · notifications ·
                               users · retention · dashboard
  proxy.ts                     next-intl locale routing + the session guard
```

Pages are server components that load through `services/portal/*.server.ts` and mutate through a
co-located `actions.ts`. Every mutation writes an audit event.

---

## Replacing the stand-ins

`src/server/mock/*` is the only seam that touches storage:

| Stand-in      | Replace with                                                     |
| ------------- | ---------------------------------------------------------------- |
| `db.ts`       | the QCP backend / a real database                                 |
| `pas.ts`      | the PAS API (`getPasValues` / `updatePasValue` keep their shapes) |
| `mailer.ts`   | SMTP or the notification service                                  |
| `retention.ts`| a scheduled job instead of the lazy sweep on page load            |
| `lib/auth/*`  | the identity portal (the template's Keycloak flow still ships)    |

Nothing above that layer changes.

## Configuration

Copy `.env.example` to `.env`. For local development the only entries that matter are
`DEV_HTTPS=false`, `DEV_OPEN_BROWSER=false` and `SESSION_SECRET`.

**`SESSION_SECRET` is required outside development** — session cookies are signed with it, and
the code refuses to start in production rather than fall back to the development key.

## Checks

```bash
pnpm type-check
pnpm lint
pnpm test:unit
```
