import { hashPasswordSync } from "@/lib/auth/password";
import type {
  Account,
  Bucket,
  ClaimDocument,
  ClaimStatus,
  LenderOrg,
  MockDb,
  PasValue,
  User,
} from "@/server/mock/types";

/**
 * Deterministic seed for `.data/imgc-db.json`. Written once, on first read. Delete `.data/` to
 * start over.
 *
 * IMGC staff sign in with an Employee ID + the password below. Lender users sign in with their
 * email + an emailed OTP (surfaced in the server console / Notifications outbox in dev).
 */

export const DEMO_IMGC_PASSWORD = "imgc@123";

const NOW = "2026-09-01T09:00:00.000Z";

const STANDARD_DOCUMENTS: ReadonlyArray<{ name: string; required: boolean }> = [
  { name: "Claim Intimation Form", required: true },
  { name: "Loan Account Statement", required: true },
  { name: "Property Valuation Report", required: true },
  { name: "Legal / Recall Notice", required: true },
  { name: "Insurance Policy Copy", required: true },
  { name: "Borrower KYC Documents", required: true },
  { name: "Additional Correspondence", required: false },
];

const PAS_TEMPLATE: ReadonlyArray<{ key: string; label: string; value: string }> = [
  { key: "sanctionedAmount", label: "Sanctioned amount", value: "" },
  { key: "outstandingPrincipal", label: "Outstanding principal", value: "" },
  { key: "overdueAmount", label: "Overdue amount", value: "" },
  { key: "emiAmount", label: "EMI amount", value: "" },
  { key: "sumInsured", label: "Sum insured (guarantee cover)", value: "" },
  { key: "claimAmount", label: "Claim amount lodged", value: "" },
];

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function buildSeed(): MockDb {
  const lenderOrgs: LenderOrg[] = [
    {
      id: "org_acme",
      name: "Acme Bank",
      emailDomain: "acme-bank.com",
      contactEmails: ["claims.desk@acme-bank.com", "ops.lead@acme-bank.com"],
    },
    {
      id: "org_northgate",
      name: "Northgate HFC",
      emailDomain: "northgate-hfc.com",
      contactEmails: ["recovery@northgate-hfc.com"],
    },
  ];

  const passwordHash = hashPasswordSync(DEMO_IMGC_PASSWORD);

  const users: User[] = [
    {
      id: "usr_emp1",
      role: "IMGC",
      name: "Meera Nair",
      email: "meera.nair@imgc.in",
      employeeId: "EMP-0001",
      passwordHash,
      createdAt: NOW,
    },
    {
      id: "usr_emp2",
      role: "IMGC",
      name: "Rohit Sharma",
      email: "rohit.sharma@imgc.in",
      employeeId: "EMP-0002",
      passwordHash,
      createdAt: NOW,
    },
    {
      id: "usr_emp3",
      role: "IMGC",
      name: "Anita Desai",
      email: "anita.desai@imgc.in",
      employeeId: "EMP-0003",
      passwordHash,
      createdAt: NOW,
    },
    {
      id: "usr_len1",
      role: "LENDER",
      name: "Arjun Mehta",
      email: "arjun@acme-bank.com",
      lenderOrgId: "org_acme",
      createdAt: NOW,
      createdBy: "usr_emp1",
    },
    {
      id: "usr_len2",
      role: "LENDER",
      name: "Priya Rao",
      email: "priya@acme-bank.com",
      lenderOrgId: "org_acme",
      createdAt: NOW,
      createdBy: "usr_emp1",
    },
    {
      id: "usr_len3",
      role: "LENDER",
      name: "Sameer Kulkarni",
      email: "sameer@northgate-hfc.com",
      lenderOrgId: "org_northgate",
      createdAt: NOW,
      createdBy: "usr_emp2",
    },
  ];

  const borrowers = [
    "Suresh Patil",
    "Kavya Iyer",
    "Imran Sheikh",
    "Deepa Menon",
    "Vikram Singh",
    "Fatima Khan",
    "Nikhil Joshi",
    "Ananya Bose",
    "Rajesh Gupta",
    "Sneha Pillai",
    "Manoj Verma",
    "Lakshmi Rao",
  ];
  const products = ["Home Loan", "LAP", "Affordable Housing", "Home Loan"];
  const buckets: Bucket[] = ["LENDER", "LENDER", "IMGC", "LENDER"];
  const claimStatuses: ClaimStatus[] = [
    "DRAFT",
    "SUBMITTED",
    "QUERIED",
    "DRAFT",
    "SUBMITTED",
    "APPROVED",
  ];

  const accounts: Account[] = [];
  const pasValues: PasValue[] = [];
  const claimDocuments: ClaimDocument[] = [];

  borrowers.forEach((borrowerName, i) => {
    const orgId = i % 3 === 2 ? "org_northgate" : "org_acme";
    const id = `acc_${String(i + 1).padStart(3, "0")}`;
    const sanctioned = 2_500_000 + i * 375_000;
    const outstanding = Math.round(sanctioned * 0.72);
    const overdue = Math.round(outstanding * 0.11);
    const bucket = buckets[i % buckets.length] ?? "LENDER";

    accounts.push({
      id,
      loanNo: `${orgId === "org_acme" ? "ACM" : "NGT"}-HL-${23000 + i * 7}`,
      borrowerName,
      lenderOrgId: orgId,
      product: products[i % products.length] ?? "Home Loan",
      bucket,
      stage: bucket === "IMGC" ? "Under IMGC review" : "Document collection",
      claimStatus: claimStatuses[i % claimStatuses.length] ?? "DRAFT",
      pushRecipients: [],
      createdAt: NOW,
    });

    const amounts: Record<string, number> = {
      sanctionedAmount: sanctioned,
      outstandingPrincipal: outstanding,
      overdueAmount: overdue,
      emiAmount: Math.round(sanctioned / 180),
      sumInsured: Math.round(sanctioned * 0.9),
      claimAmount: outstanding,
    };
    PAS_TEMPLATE.forEach((t) => {
      pasValues.push({
        id: `pas_${id}_${t.key}`,
        accountId: id,
        key: t.key,
        label: t.label,
        value: inr(amounts[t.key] ?? 0),
        source: "PAS",
        updatedAt: NOW,
        updatedBy: "PAS",
      });
    });

    STANDARD_DOCUMENTS.forEach((d, di) => {
      claimDocuments.push({
        id: `doc_${id}_${di}`,
        accountId: id,
        name: d.name,
        required: d.required,
        addedBy: "SYSTEM",
        status: "PENDING",
        createdAt: NOW,
      });
    });
  });

  return {
    lenderOrgs,
    users,
    otps: [],
    accounts,
    pasValues,
    claimDocuments,
    documentFiles: [],
    remarks: [],
    auditEvents: [],
    notifications: [],
  };
}
