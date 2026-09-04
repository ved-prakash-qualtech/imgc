import "server-only";

import axios, { type AxiosInstance } from "axios";
import https from "node:https";
import { cookies } from "next/headers";

import { getSessionScope } from "@/lib/auth/session";
import { SSR_HTTP_TIMEOUT_MS } from "@/services/api/constants";

/**
 * Talks to identity-portal-service as the person who is signed in.
 *
 * The master admin's own token is forwarded rather than an application client credential, and
 * that is the point: the portal enforces MASTER_ADMIN against the actual user, so someone who
 * loses the role loses the ability with no change here, and the audit trail says which person
 * created a menu rather than which application did. A client credential is right for unattended
 * work — the tenant reconcile — where there is no user to act as.
 *
 * The portal decides which level a request is in from the `Host` header, so every call carries
 * the application-master hostname explicitly. Connecting to the portal's origin while sending a
 * different Host is deliberate: locally both names resolve to the same address, and on a server
 * the edge routes on the same header.
 */

/** The portal's L3 host for this application — `admin-{product}-{platformTenant}-identity-{env}`. */
function applicationMasterHost(): string {
  const configured = process.env.IDENTITY_PORTAL_L3_HOST;
  if (!configured) {
    throw new Error(
      "IDENTITY_PORTAL_L3_HOST is not set, so no request can be placed in application-master scope"
    );
  }
  return configured;
}

/**
 * The portal host for one application tenant — L4.
 *
 * <p>Derived from the L3 host by swapping its leading label, rather than configured separately:
 * the two differ by exactly that label (`admin-boilerplate-qc-identity-local` becomes
 * `qc-boilerplate-qc-identity-local`), and a second environment variable would be one more thing
 * to keep in step for no gain. A per-tenant variable is impossible in any case — tenants are
 * onboarded at runtime, and the host has to follow.
 */
function splitMasterHost(): { labels: string[]; rest: string } {
  const master = applicationMasterHost();
  const firstDot = master.indexOf(".");
  const subdomain = firstDot === -1 ? master : master.slice(0, firstDot);
  const rest = firstDot === -1 ? "" : master.slice(firstDot);

  const labels = subdomain.split("-");
  // Nothing to derive from: an L3 host that is not {level}-{product}-{tenant}-identity-{env} is
  // one this cannot rewrite, and guessing would silently address the wrong level.
  if (labels.length < 4) {
    throw new Error(
      `IDENTITY_PORTAL_L3_HOST ('${master}') is not in the form admin-{product}-{tenant}-identity-{env}, ` +
        "so the other portal levels cannot be derived from it"
    );
  }
  return { labels, rest };
}

function applicationTenantHost(tenantCode: string): string {
  const { labels, rest } = splitMasterHost();
  return [tenantCode, ...labels.slice(1)].join("-") + rest;
}

/**
 * The portal's L2 host — the organization level, `{platformTenant}-identity-{env}`.
 *
 * <p>Derived by dropping the two leading labels of the L3 host:
 * `admin-boilerplate-qc-identity-local` is the application master, and `qc-identity-local` is the
 * organization it belongs to.
 *
 * <p>This exists because users are authored at L2 and nowhere else. An application tenant *sees*
 * its people — `/api/v1/application/users` is read-only, GET and nothing more — but adding one
 * means adding them to the organization and granting them the application, after which the portal
 * fans them out to the application-tenant database. So the tenant Users screen reads at L4 and
 * writes at L2, and needs both hosts.
 */
function organizationHost(): string {
  const { labels, rest } = splitMasterHost();
  return labels.slice(2).join("-") + rest;
}

/**
 * The application's code, from the L3 host — `boilerplate` in
 * `admin-boilerplate-qc-identity-local`.
 *
 * <p>Taken from the host rather than configured separately for the same reason the other levels
 * are: it is already there, and a second variable is one more thing to keep in step. Used to find
 * the application's id when granting it to a new user.
 */
export function applicationCode(): string {
  // splitMasterHost has already refused anything with fewer than four labels, so this is present;
  // the fallback is for the type checker, which cannot know that.
  return splitMasterHost().labels[1] ?? "";
}

/**
 * Which level this request belongs in, from who is signed in.
 *
 * <p>An administrator signed in on the admin host reads the application master level; a tenant
 * signed in on their own host reads their own. Same screens, same endpoints, different level —
 * and the level is the hostname, so this is the only thing that has to differ.
 */
export async function portalHost(): Promise<string> {
  const { scope, tenant } = await getSessionScope();
  if (scope === "TENANT") {
    if (!tenant) {
      throw new Error(
        "Tenant scope with no tenant code — the portal level cannot be resolved"
      );
    }
    return applicationTenantHost(tenant);
  }
  return applicationMasterHost();
}

function portalOrigin(): string {
  const configured = process.env.IDENTITY_PORTAL_URL;
  if (!configured) {
    throw new Error("IDENTITY_PORTAL_URL is not set");
  }
  return configured.replace(/\/+$/, "");
}

export async function portalClient(): Promise<AxiosInstance> {
  return portalClientFor(await portalHost());
}

/**
 * A client for the organization level, whatever level the caller is signed in at.
 *
 * <p>The same bearer token: a tenant administrator holds ROLE_TENANT_ADMIN at L2, which is what
 * POST /api/v1/organization/users requires. Nothing is escalated here — the portal still decides,
 * against the actual user, whether they may add someone to the organization.
 */
export async function organizationClient(): Promise<AxiosInstance> {
  return portalClientFor(organizationHost());
}

async function portalClientFor(host: string): Promise<AxiosInstance> {
  const token = (await cookies()).get("accessToken")?.value;

  return axios.create({
    baseURL: portalOrigin(),
    timeout: SSR_HTTP_TIMEOUT_MS,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Both, because a request may reach the portal directly or through an edge, and the two
      // read different headers to decide the level.
      Host: host,
      "X-Forwarded-Host": host,
    },
    // Local only: the portal serves a self-signed certificate on 9941. On a server this is the
    // estate's real certificate and the flag comes off with HTTP_CLIENT_SSL_VERIFY.
    httpsAgent: new https.Agent({
      rejectUnauthorized: process.env.IDENTITY_PORTAL_SSL_VERIFY === "true",
    }),
  });
}

/** The portal's APIResponse envelope. */
export type PortalResponse<T> = Readonly<{
  status: string;
  statusCode: number;
  message?: string;
  errorMessage?: string;
  data?: T;
}>;

/**
 * Turns an axios failure into the portal's own message.
 *
 * The portal says useful things — which field, which rule, which role was required — and the
 * default axios message ("Request failed with status code 403") throws all of it away.
 */
export function portalErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as PortalResponse<unknown> | undefined;
    if (body?.errorMessage) return body.errorMessage;
    if (error.response?.status === 403) {
      return "The identity portal refused this: your account is not a master admin for this application.";
    }
    if (error.response?.status === 401) {
      return "The identity portal did not accept your session. Sign in again.";
    }
  }
  return fallback;
}
