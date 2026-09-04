import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createExampleSchema, type Example } from "@/types/example.types";
import type { APIResponse } from "@/types/api.types";
import { findRegistryTenant } from "@/server/standInRegistry";

/**
 * Stand-in TENANT-SCOPED backend so the template runs standalone.
 * Mirrors the QCP multitenant backend behaviour (QCC Multi-Tenancy):
 * - the tenant comes from the forwarded x-tenant header (set by middleware)
 * - unknown/missing tenant → 403 QT-TEN-403 (deny by default — the registry
 *   is the authority)
 * - data is physically partitioned per tenant (one store per tenant here;
 *   one DATABASE per tenant in the real backend)
 * Delete in a real product — ssrApi then talks to the tenant's backend.
 */
const tenantStores = new Map<string, Example[]>();

function storeFor(tenant: string): Example[] {
  let store = tenantStores.get(tenant);
  if (!store) {
    store = [
      {
        id: uuid(),
        name: `Sample Example A (tenant ${tenant})`,
        description: `Seeded row in the isolated ${tenant} store`,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      },
      {
        id: uuid(),
        name: `Sample Example B (tenant ${tenant})`,
        description: `Second seeded row for tenant ${tenant}`,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
    ];
    tenantStores.set(tenant, store);
  }
  return store;
}

function envelope<T>(partial: Omit<APIResponse<T>, "timestamp">): APIResponse<T> {
  return { ...partial, timestamp: new Date().toISOString() };
}

function rejectTenant(path: string) {
  return NextResponse.json(
    envelope<never>({
      status: "ERROR",
      statusCode: 403,
      errorCode: "QT-TEN-403",
      errorMessage: "Invalid tenant",
      path,
    }),
    { status: 403 },
  );
}

export async function GET(req: NextRequest) {
  const tenant = findRegistryTenant(req.headers.get("x-tenant"));
  if (!tenant) return rejectTenant(req.nextUrl.pathname);

  return NextResponse.json(
    envelope<Example[]>({
      status: "SUCCESS",
      statusCode: 200,
      message: "OK",
      data: storeFor(tenant.shortCode),
    }),
  );
}

export async function POST(req: NextRequest) {
  const tenant = findRegistryTenant(req.headers.get("x-tenant"));
  if (!tenant) return rejectTenant(req.nextUrl.pathname);

  const body = await req.json();
  const parsed = createExampleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      envelope<never>({
        status: "ERROR",
        statusCode: 400,
        errorCode: "QT-VAL-001",
        errorMessage: "Validation failed",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          errorCode: "QT-VAL-010",
          errorMessage: issue.message,
        })),
      }),
      { status: 400 },
    );
  }

  const created: Example = {
    id: uuid(),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  storeFor(tenant.shortCode).push(created);

  return NextResponse.json(
    envelope<Example>({ status: "SUCCESS", statusCode: 201, message: "Example created", data: created }),
    { status: 201 },
  );
}
