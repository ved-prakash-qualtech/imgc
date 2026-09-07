import { hashPasswordSync } from "@/lib/auth/password";
import {
  CLAIM_TYPES,
  conditionReason,
  docConditionMet,
} from "@/config/claimConfig";
import type {
  Account,
  ClaimDocument,
  ClaimStatus,
  DocStatus,
  DocumentFile,
  LenderOrg,
  Claim,
  ClaimQuery,
  ClaimTypeKey,
  MockDb,
  PasValue,
  Priority,
  User,
} from "@/server/mock/types";

/**
 * Deterministic seed for `.data/imgc-db.json`. Written once, on first read. Delete `.data/` to
 * start over.
 *
 * The cases and the document matrix below are the demo the BRD describes, so every status a rule
 * can produce is on screen from the first load rather than having to be manufactured by clicking.
 */

export const DEMO_IMGC_PASSWORD = "imgc@123";

const NOW = "2026-09-04T09:00:00.000Z";
const ago = (days: number): string =>
  new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
const ahead = (days: number): string =>
  new Date(Date.parse(NOW) + days * 86_400_000).toISOString();

// STANDARD_DOCUMENTS removed

/** Cycled by account index (independent of `npa`/`writeOff`) so the seeded book has a realistic
 *  spread of Days Past Due across every bucket, including non-NPA accounts with real DPD. */
const DPD_CYCLE = [0, 10, 15, 30, 31, 45, 60, 75, 90, 120] as const;

const PAS_TEMPLATE: ReadonlyArray<{ key: string; label: string }> = [
  { key: "sanctionedAmount", label: "Sanctioned amount" },
  { key: "outstandingPrincipal", label: "Outstanding principal" },
  { key: "overdueAmount", label: "Overdue amount" },
  { key: "emiAmount", label: "EMI amount" },
  { key: "sumInsured", label: "Sum insured (guarantee cover)" },
  { key: "claimAmount", label: "Claim amount lodged" },
];

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** One row of the additional-documents matrix from the BRD. */
type Additional = Readonly<{
  name: string;
  category: string;
  required: boolean;
  status: DocStatus;
  priority?: Priority;
  description?: string;
  dueInDays?: number;
  /** Present when the status implies a file exists. */
  file?: { name: string; version: number; number?: string; remarks?: string };
  /** Present for REJECTED / REUPLOAD_REQUIRED / APPROVED. */
  review?: {
    decision: "APPROVED" | "REJECTED" | "REUPLOAD_REQUESTED";
    remarks: string;
  };
  /** An older version kept in history, for the version-history demo. */
  previous?: { name: string; version: number; supersededReason: string };
}>;

const CASES: ReadonlyArray<{
  id: string;
  loanNo: string;
  borrowerName: string;
  orgId: string;
  product: string;
  region: string;
  branch: string;
  assigned: [string, string];
  appDaysAgo: number;
  claimStatus: ClaimStatus;
  bucket: "IMGC" | "LENDER";
  additional: readonly Additional[];
  /** Overrides the index-based npa/write-off split below — used for demo padding, where every
   *  added row needs to land in the NPA-only "Initiate Claim" grid regardless of its position. */
  forceNpa?: boolean;
  forceWriteOff?: boolean;
}> = [
  {
    id: "acc_100245",
    loanNo: "3002060000000",
    borrowerName: "Rajesh Sharma",
    orgId: "org_acme",
    product: "Home Loan",
    region: "West",
    branch: "Andheri East",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 21,
    claimStatus: "SUBMITTED",
    bucket: "IMGC",
    additional: [
      {
        name: "NOC",
        category: "Property Document",
        required: true,
        status: "PENDING_UPLOAD",
        priority: "HIGH",
        dueInDays: 5,
        description:
          "Please upload the latest NOC issued by the concerned authority.",
      },
      {
        name: "Bank Statement",
        category: "Financial Document",
        required: true,
        status: "UNDER_REVIEW",
        dueInDays: 7,
        description: "Last 12 months, all operative accounts, bank-stamped.",
        file: {
          name: "Bank_Statement_April_2026.pdf",
          version: 1,
          number: "ACME/STMT/2026/0412",
          remarks: "Statement for the primary operative account.",
        },
      },
      {
        name: "Property Tax Receipt",
        category: "Property Document",
        required: true,
        status: "APPROVED",
        description: "Latest municipal tax receipt showing no arrears.",
        file: {
          name: "Property_Tax_Receipt.pdf",
          version: 1,
          number: "MCGM/2026/88213",
        },
        review: {
          decision: "APPROVED",
          remarks: "Verified against the municipal portal.",
        },
      },
      {
        name: "Possession Letter",
        category: "Legal Document",
        required: false,
        status: "NOT_REQUESTED",
        description: "Builder or authority possession letter, original scan.",
      },
    ],
  },
  {
    id: "acc_100246",
    loanNo: "3002060000001",
    borrowerName: "Kavya Iyer",
    orgId: "org_acme",
    product: "LAP",
    region: "South",
    branch: "Koramangala",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 17,
    claimStatus: "QUERIED",
    bucket: "IMGC",
    additional: [
      {
        name: "NOC",
        category: "Property Document",
        required: true,
        status: "APPROVED",
        file: { name: "Kavya_Iyer_NOC.pdf", version: 1 },
        review: {
          decision: "APPROVED",
          remarks: "NOC current and correctly stamped.",
        },
      },
      {
        name: "Additional KYC",
        category: "KYC Document",
        required: true,
        status: "REUPLOAD_REQUIRED",
        priority: "URGENT",
        dueInDays: 2,
        description:
          "Any one additional officially valid document for the borrower.",
        file: { name: "Kavya_Iyer_KYC_v1.pdf", version: 1 },
        review: {
          decision: "REUPLOAD_REQUESTED",
          remarks:
            "The uploaded document is unclear. Please upload a readable copy.",
        },
      },
      {
        name: "Property Tax Receipt",
        category: "Property Document",
        required: false,
        status: "PENDING_UPLOAD",
        dueInDays: 12,
      },
    ],
  },
  {
    id: "acc_100247",
    loanNo: "3002060000002",
    borrowerName: "Imran Sheikh",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "North",
    branch: "Rohini",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 12,
    claimStatus: "QUERIED",
    bucket: "LENDER",
    additional: [
      {
        name: "NOC",
        category: "Property Document",
        required: true,
        status: "REJECTED",
        priority: "HIGH",
        dueInDays: -2,
        description:
          "Society NOC on letterhead, signed within the last 90 days.",
        file: { name: "Imran_Sheikh_NOC_v2.pdf", version: 2 },
        review: {
          decision: "REJECTED",
          remarks: "Uploaded NOC is outdated. Please provide the latest NOC.",
        },
        previous: {
          name: "Imran_Sheikh_NOC_v1.pdf",
          version: 1,
          supersededReason: "Document was unclear.",
        },
      },
      {
        name: "Bank Statement",
        category: "Financial Document",
        required: true,
        status: "APPROVED",
        file: { name: "Imran_Bank_Statement.pdf", version: 1 },
        review: { decision: "APPROVED", remarks: "Verified." },
      },
    ],
  },
  {
    id: "acc_100248",
    loanNo: "3002060000003",
    borrowerName: "Deepa Menon",
    orgId: "org_acme",
    product: "Home Loan",
    region: "West",
    branch: "Thane",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 8,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [
      {
        name: "Possession Letter",
        category: "Legal Document",
        required: true,
        status: "PENDING_UPLOAD",
        dueInDays: 9,
        description: "Builder possession letter, original scan.",
      },
    ],
  },
  {
    id: "acc_100249",
    loanNo: "3002060000004",
    borrowerName: "Sneha Pillai",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "South",
    branch: "T Nagar",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 4,
    claimStatus: "SUBMITTED",
    bucket: "IMGC",
    additional: [
      {
        name: "NOC",
        category: "Property Document",
        required: true,
        status: "APPROVED",
        file: { name: "Sneha_Pillai_NOC.pdf", version: 1 },
        review: { decision: "APPROVED", remarks: "In order." },
      },
      {
        name: "Bank Statement",
        category: "Financial Document",
        required: true,
        status: "UNDER_REVIEW",
        file: { name: "Sneha_Bank_Statement.pdf", version: 1 },
      },
    ],
  },
  {
    id: "acc_100250",
    loanNo: "3002060000005",
    borrowerName: "Vikram Singh",
    orgId: "org_acme",
    product: "LAP",
    region: "North",
    branch: "Karol Bagh",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 34,
    claimStatus: "APPROVED",
    bucket: "IMGC",
    additional: [
      {
        name: "Settlement Agreement",
        category: "Legal Document",
        required: true,
        status: "APPROVED",
        file: { name: "Vikram_Singh_Settlement.pdf", version: 1 },
        review: { decision: "APPROVED", remarks: "Executed copy verified." },
      },
    ],
  },
  {
    id: "acc_100251",
    loanNo: "3002060000006",
    borrowerName: "Fatima Khan",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "West",
    branch: "Bandra",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 28,
    claimStatus: "QUERIED",
    bucket: "IMGC",
    additional: [
      {
        name: "Property Valuation Report",
        category: "Property Document",
        required: true,
        status: "REJECTED",
        file: { name: "Fatima_Khan_Valuation.pdf", version: 1 },
        review: {
          decision: "REJECTED",
          remarks: "Valuation predates the default by more than 12 months.",
        },
      },
    ],
  },
  {
    id: "acc_100252",
    loanNo: "3002060000007",
    borrowerName: "Nikhil Joshi",
    orgId: "org_acme",
    product: "Home Loan",
    region: "West",
    branch: "Powai",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 6,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
  },
  {
    id: "acc_100253",
    loanNo: "3002060000008",
    borrowerName: "Ananya Bose",
    orgId: "org_northgate",
    product: "LAP",
    region: "East",
    branch: "Salt Lake",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 3,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
  },
  {
    id: "acc_100254",
    loanNo: "3002060000009",
    borrowerName: "Rohan Kapoor",
    orgId: "org_acme",
    product: "Home Loan",
    region: "West",
    branch: "Goregaon",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 4,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
  },
  // Demo padding — extra Acme NPA accounts so the lender's "Initiate Claim" grid shows a
  // realistic double-digit row count. Appended rather than interleaved so every SCENARIOS
  // `accountIndex` above keeps pointing at the same account.
  {
    id: "acc_100255",
    loanNo: "3002060000010",
    borrowerName: "Priyanka Reddy",
    orgId: "org_acme",
    product: "Home Loan",
    region: "South",
    branch: "Hitech City",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 15,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100256",
    loanNo: "3002060000011",
    borrowerName: "Arvind Kumar",
    orgId: "org_acme",
    product: "LAP",
    region: "North",
    branch: "Dwarka",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 22,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100257",
    loanNo: "3002060000012",
    borrowerName: "Neha Kapadia",
    orgId: "org_acme",
    product: "Home Loan",
    region: "West",
    branch: "Malad",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 9,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100258",
    loanNo: "3002060000013",
    borrowerName: "Suresh Nair",
    orgId: "org_acme",
    product: "Home Loan",
    region: "South",
    branch: "Velachery",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 30,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100259",
    loanNo: "3002060000014",
    borrowerName: "Divya Krishnan",
    orgId: "org_acme",
    product: "Home Loan",
    region: "East",
    branch: "Salt Lake",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 6,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100260",
    loanNo: "3002060000015",
    borrowerName: "Manoj Tiwari",
    orgId: "org_acme",
    product: "LAP",
    region: "North",
    branch: "Lajpat Nagar",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 18,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  // Demo padding — extra Northgate NPA accounts, same reasoning as the Acme block above, so
  // that lender's "Initiate Claim" grid also shows a realistic double-digit row count.
  {
    id: "acc_100261",
    loanNo: "3002060000016",
    borrowerName: "Ritu Chawla",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "North",
    branch: "Pitampura",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 13,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100262",
    loanNo: "3002060000017",
    borrowerName: "Karthik Subramaniam",
    orgId: "org_northgate",
    product: "LAP",
    region: "South",
    branch: "Adyar",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 26,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100263",
    loanNo: "3002060000018",
    borrowerName: "Pooja Agarwal",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "East",
    branch: "New Town",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 7,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100264",
    loanNo: "3002060000019",
    borrowerName: "Vivek Malhotra",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "West",
    branch: "Vashi",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 19,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100265",
    loanNo: "3002060000020",
    borrowerName: "Shreya Bhatt",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "West",
    branch: "Vadodara",
    assigned: ["usr_emp1", "Meera Nair"],
    appDaysAgo: 24,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100266",
    loanNo: "3002060000021",
    borrowerName: "Abhishek Ranjan",
    orgId: "org_northgate",
    product: "LAP",
    region: "North",
    branch: "Indirapuram",
    assigned: ["usr_emp2", "Rohit Sharma"],
    appDaysAgo: 11,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
  {
    id: "acc_100267",
    loanNo: "3002060000022",
    borrowerName: "Lakshmi Narayanan",
    orgId: "org_northgate",
    product: "Home Loan",
    region: "South",
    branch: "Anna Nagar",
    assigned: ["usr_emp3", "Anita Desai"],
    appDaysAgo: 29,
    claimStatus: "DRAFT",
    bucket: "LENDER",
    additional: [],
    forceNpa: true,
    forceWriteOff: false,
  },
];

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
      phone: "+91 98201 44092",
      passwordHash,
      createdAt: NOW,
    },
    {
      id: "usr_emp2",
      role: "IMGC",
      name: "Rohit Sharma",
      email: "rohit.sharma@imgc.in",
      employeeId: "EMP-0002",
      phone: "+91 98201 44093",
      passwordHash,
      createdAt: NOW,
    },
    {
      id: "usr_emp3",
      role: "IMGC",
      name: "Anita Desai",
      email: "anita.desai@imgc.in",
      employeeId: "EMP-0003",
      phone: "+91 98201 44094",
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

  const accounts: Account[] = [];
  const pasValues: PasValue[] = [];
  const claimDocuments: ClaimDocument[] = [];
  const documentFiles: DocumentFile[] = [];

  CASES.forEach((c, i) => {
    const lenderUser = users.find((u) => u.lenderOrgId === c.orgId);
    const sanctioned = 2_500_000 + i * 640_000;
    const outstanding = Math.round(sanctioned * 0.72);

    // Every seeded case is claim-eligible so the lifecycle demo has something to act on.
    // acc_100254 is the "eligible, no claim yet" demo row — force it NPA so it always shows
    // the Initiate Claim action for the Acme lender.
    const isNpa = c.forceNpa ?? (c.id === "acc_100254" ? true : i % 3 !== 1);
    const isWriteOff =
      c.forceWriteOff ?? (c.id === "acc_100254" ? false : i % 3 === 1);

    // Odd-indexed accounts were under construction at disbursal — drives the conditional
    // "Latest Technical Report" document. Even-indexed were ready to move.
    // acc_100245 is forced true regardless of its (even) index: it backs CLM-2026-00001, the
    // only seeded Initial Claim otherwise left demonstrating this document as always-optional —
    // every other Initial Claim scenario also lands on an even index, so without this override
    // no seeded claim ever shows "Latest Technical Report" as required.
    const underConstruction = c.id === "acc_100245" ? true : i % 2 === 1;

    // DPD is a collections metric, not derived from `isNpa` — deliberately cycled independently
    // of it so the mix includes accounts well past due that haven't been tagged NPA yet (and the
    // reverse), the exact case the DPD screen exists to surface beyond the NPA-only claim grid.
    const dpd = DPD_CYCLE[i % DPD_CYCLE.length];

    accounts.push({
      npa: isNpa,
      writeOff: isWriteOff,
      dpd,
      id: c.id,
      loanNo: c.loanNo,
      borrowerName: c.borrowerName,
      lenderOrgId: c.orgId,
      product: c.product,
      region: c.region,
      branch: c.branch,
      assignedUserId: c.assigned[0],
      assignedUserName: c.assigned[1],
      applicationDate: ago(c.appDaysAgo),
      loanAmount: sanctioned,
      outstandingAmount: outstanding,
      sanctionDate: ago(c.appDaysAgo + 1400).slice(0, 10),
      disbursementDate: ago(c.appDaysAgo + 1387).slice(0, 10),
      tenureMonths: 180 + (i % 4) * 60,
      propertyType:
        i % 3 === 0
          ? "Residential"
          : i % 3 === 1
            ? "Residential"
            : "Commercial",
      propertyStatus: underConstruction
        ? "Under Construction"
        : "Ready to Move",
      propertyStatusAtDisbursal: underConstruction
        ? "UNDER_CONSTRUCTION"
        : "READY_TO_MOVE",
      bucket: c.bucket,
      stage: c.bucket === "IMGC" ? "Under IMGC review" : "Document collection",
      claimStatus: c.claimStatus,
      pushRecipients: [],
      createdAt: ago(c.appDaysAgo),
    });

    const amounts: Record<string, number> = {
      sanctionedAmount: sanctioned,
      outstandingPrincipal: outstanding,
      overdueAmount: Math.round(outstanding * 0.11),
      emiAmount: Math.round(sanctioned / 180),
      sumInsured: Math.round(sanctioned * 0.9),
      claimAmount: outstanding,
    };
    PAS_TEMPLATE.forEach((t) => {
      pasValues.push({
        id: `pas_${c.id}_${t.key}`,
        accountId: c.id,
        key: t.key,
        label: t.label,
        value: inr(amounts[t.key] ?? 0),
        source: "PAS",
        updatedAt: ago(2),
        updatedBy: "PAS",
      });
    });

    // Legacy STANDARD_DOCUMENTS removed to fix IMGC checklist showing unrelated account-level documents.

    // The IMGC-authored additional documents.
    c.additional.forEach((a, ai) => {
      const docId = `doc_${c.id}_add${ai}`;
      let currentFileId: string | undefined;

      if (a.previous) {
        documentFiles.push({
          id: `${docId}_f${a.previous.version}`,
          documentId: docId,
          accountId: c.id,
          originalName: a.previous.name,
          storedPath: "",
          size: 184_320,
          mime: "application/pdf",
          uploadedBy: lenderUser?.id ?? "usr_len1",
          uploadedByName: lenderUser?.name ?? "Arjun Mehta",
          uploadedAt: ago(6),
          version: a.previous.version,
          supersededAt: ago(4),
          supersededReason: a.previous.supersededReason,
        });
      }
      if (a.file) {
        currentFileId = `${docId}_f${a.file.version}`;
        documentFiles.push({
          id: currentFileId,
          documentId: docId,
          accountId: c.id,
          originalName: a.file.name,
          storedPath: "",
          size: 246_784,
          mime: "application/pdf",
          uploadedBy: lenderUser?.id ?? "usr_len1",
          uploadedByName: lenderUser?.name ?? "Arjun Mehta",
          uploadedAt: ago(3),
          version: a.file.version,
          documentNumber: a.file.number,
          uploadRemarks: a.file.remarks,
          documentDate: ago(30).slice(0, 10),
        });
      }

      claimDocuments.push({
        id: docId,
        accountId: c.id,
        name: a.name,
        required: a.required,
        addedBy: "IMGC",
        addedByName: c.assigned[1],
        status: a.status,
        category: a.category,
        description: a.description,
        applicableProduct: c.product,
        applicableCaseType: "Initial Claim",
        dueDate: a.dueInDays === undefined ? undefined : ahead(a.dueInDays),
        priority: a.priority ?? "NORMAL",
        active: true,
        version: a.file?.version ?? 0,
        currentFileId,
        createdAt: ago(Math.max(1, c.appDaysAgo - 4)),
        rejection:
          a.status === "REJECTED"
            ? {
                at: ago(5),
                by: c.assigned[1] ?? "Meera Nair",
                reason: a.review?.remarks ?? "Document is outdated.",
              }
            : undefined,
        review: a.review
          ? {
              decision: a.review.decision,
              by: c.assigned[0],
              byName: c.assigned[1],
              at: ago(2),
              remarks: a.review.remarks,
              version: a.file?.version ?? 1,
            }
          : undefined,
      });
    });
  });

  const { claims, claimQueries } = buildClaims(
    accounts,
    claimDocuments,
    documentFiles
  );

  return {
    lenderOrgs,
    users,
    otps: [],
    accounts,
    pasValues,
    claimDocuments,
    documentFiles,
    claims,
    claimQueries,
    remarks: [],
    auditEvents: [],
    notifications: [],
  };
}

/* ── claims: the seven lifecycle scenarios ─────────────────────────── */

type Scenario = Readonly<{
  accountIndex: number;
  type: ClaimTypeKey;
  status: ClaimStatus;
  daysAgo: number;
  /** Statuses walked through before the current one, oldest first. */
  history: readonly ClaimStatus[];
  fieldsComplete: boolean;
  /** How many of the checklist's required documents are already approved. */
  approvedDocs: number;
  query?: {
    reason: string;
    remarks: string;
    requested: string[];
    answered: boolean;
  };
  decision?: { outcome: "APPROVED" | "REJECTED" | "CLOSED"; remarks: string };
}>;

/**
 * One case per scenario, so every state the UI can render is on screen from first load:
 * draft, submitted, under review, query raised, documents resubmitted, approved, rejected.
 */
const SCENARIOS: readonly Scenario[] = [
  {
    accountIndex: 0,
    type: "INITIAL",
    status: "QUERY_RAISED",
    daysAgo: 9,
    history: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
    fieldsComplete: true,
    approvedDocs: 2,
    query: {
      reason: "Please upload the NOC document.",
      remarks: "The recall notice references an NOC that was not attached.",
      requested: ["Legal / Recall Notice"],
      answered: false,
    },
  },
  {
    accountIndex: 1,
    type: "SUBSEQUENT",
    status: "DRAFT",
    daysAgo: 2,
    history: [],
    fieldsComplete: false,
    approvedDocs: 0,
  },
  {
    accountIndex: 2,
    type: "INITIAL",
    status: "SUBMITTED",
    daysAgo: 4,
    history: ["DRAFT"],
    fieldsComplete: true,
    approvedDocs: 0,
  },
  {
    accountIndex: 3,
    type: "SUBSEQUENT",
    status: "UNDER_REVIEW",
    daysAgo: 6,
    history: ["DRAFT", "SUBMITTED"],
    fieldsComplete: true,
    approvedDocs: 3,
  },
  {
    accountIndex: 4,
    type: "INITIAL",
    status: "DOCUMENTS_RESUBMITTED",
    daysAgo: 5,
    history: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED"],
    fieldsComplete: true,
    approvedDocs: 3,
    query: {
      reason: "The uploaded statement is illegible.",
      remarks: "Please provide a bank-stamped copy at 300dpi.",
      requested: ["Loan Account Statement"],
      answered: true,
    },
  },
  {
    accountIndex: 5,
    type: "SUBSEQUENT",
    status: "APPROVED",
    daysAgo: 14,
    history: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
    fieldsComplete: true,
    approvedDocs: 99,
    decision: {
      outcome: "APPROVED",
      remarks: "Settlement verified. Claim payable in full.",
    },
  },
  {
    accountIndex: 6,
    type: "INITIAL",
    status: "REJECTED",
    daysAgo: 11,
    history: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
    fieldsComplete: true,
    approvedDocs: 1,
    decision: {
      outcome: "REJECTED",
      remarks:
        "Account was not in the guarantee cover period at the date of default.",
    },
  },
];

const SAMPLE_FIELDS: Record<string, string> = {
  // Claim program (config/claimConfig.ts CLAIM_PROGRAM_FIELDS)
  claimsProgram: "Developer Under Construction>85%",
  ineligibleClaim: "No",
  // Borrower
  coApplicantName: "Sunita Sharma",
  borrowerMobile: "9820012345",
  borrowerEmail: "borrower@example.com",
  borrowerPan: "ABCDE1234F",
  // Loan
  sanctionedAmount: "4500000",
  disbursedAmount: "4500000",
  disbursementDate: ago(1600).slice(0, 10),
  loanTenureMonths: "240",
  interestRate: "9.25",
  emiAmount: "42000",
  currentOutstanding: "3240000",
  // Default
  npaDate: ago(120).slice(0, 10),
  lastEmiDate: ago(210).slice(0, 10),
  daysPastDue: "210",
  assetClassification: "Doubtful 1",
  defaultReason: "Loss of employment",
  // Legal action (Initial)
  recallNoticeDate: ago(90).slice(0, 10),
  legalNoticeDate: ago(60).slice(0, 10),
  sarfaesiStatus: "13(2) notice served",
  recoverySuitFiled: "No",
  // Claim & recovery
  claimAmount: "2400000",
  principalOutstanding: "2250000",
  interestOutstanding: "150000",
  recoveryToDate: "150000",
  // Lender contact
  contactPerson: "Arjun Mehta",
  contactDesignation: "Manager - Recovery",
  contactPhone: "9820098200",
  contactEmail: "arjun@acme-bank.com",
  // Additional
  remarks: "Borrower unreachable since the second recall notice.",
  // Subsequent (final loss)
  recoveryMode: "One-time settlement",
  recoveryClosedDate: ago(30).slice(0, 10),
  grossRecovered: "1850000",
  recoveryExpenses: "120000",
  netLossClaimed: "550000",
  subsequentApprovedBy: "Recovery Committee",
};

function buildClaims(
  accounts: Account[],
  claimDocuments: ClaimDocument[],
  documentFiles: DocumentFile[]
): { claims: Claim[]; claimQueries: ClaimQuery[] } {
  const claims: Claim[] = [];
  const claimQueries: ClaimQuery[] = [];
  const counters: Record<string, number> = {};

  SCENARIOS.forEach((sc, n) => {
    const account = accounts[sc.accountIndex];
    if (!account) return;

    const config = CLAIM_TYPES[sc.type];
    counters[config.prefix] = (counters[config.prefix] ?? 0) + 1;
    const claimId = `clm_${String(n + 1).padStart(3, "0")}`;
    const seq = String(counters[config.prefix]).padStart(5, "0");
    const claimNo = `${config.prefix}-2026-${seq}`;
    const actorId = "usr_len1";
    const actorName = "Arjun Mehta";

    // Walked in order, so the timeline has real, increasing timestamps.
    const steps = [...sc.history, sc.status];
    const statusHistory = steps.map((status, i) => {
      const imgcSide =
        status === "UNDER_REVIEW" ||
        status === "QUERY_RAISED" ||
        status === "APPROVED" ||
        status === "REJECTED" ||
        status === "CLOSED";
      return {
        status,
        at: ago(sc.daysAgo - i * (sc.daysAgo / (steps.length + 1))),
        byId: imgcSide ? "usr_emp1" : actorId,
        byName: imgcSide ? "Meera Nair" : actorName,
        byRole: (imgcSide ? "IMGC" : "LENDER") as "IMGC" | "LENDER",
      };
    });

    claims.push({
      id: claimId,
      claimNo,
      accountId: account.id,
      claimType: sc.type,
      status: sc.status,
      fields: sc.fieldsComplete
        ? Object.fromEntries(
            config.fields.map((f) => [f.id, SAMPLE_FIELDS[f.id] ?? ""])
          )
        : { contactPerson: actorName },
      statusHistory,
      createdById: actorId,
      createdByName: actorName,
      createdAt: ago(sc.daysAgo),
      submittedAt: sc.status === "DRAFT" ? undefined : ago(sc.daysAgo - 1),
      lastUpdatedAt:
        statusHistory[statusHistory.length - 1]?.at ?? ago(sc.daysAgo),
      // Every seeded scenario has real backstory (even "Draft" represents a lender mid-way
      // through, not one who merely opened the form) — distinct from an account with no claim
      // at all, which is how the seed represents a genuinely untouched "Initiate Claim" row.
      draftSaved: true,
      bucket:
        sc.status === "DRAFT" || sc.status === "QUERY_RAISED"
          ? "LENDER"
          : "IMGC",
      decision: sc.decision
        ? {
            outcome: sc.decision.outcome,
            byId: "usr_emp1",
            byName: "Meera Nair",
            at: ago(1),
            remarks: sc.decision.remarks,
          }
        : undefined,
    });

    // The configured checklist, materialised with this scenario's progress applied.
    config.documents.forEach((spec, i) => {
      const requested =
        Boolean(sc.query?.requested.includes(spec.name)) && !sc.query?.answered;
      const approved = i < sc.approvedDocs;
      const status: DocStatus = requested
        ? "REUPLOAD_REQUIRED"
        : approved
          ? "APPROVED"
          : sc.status === "DRAFT"
            ? "PENDING_UPLOAD"
            : "UNDER_REVIEW";

      const loan = account as unknown as Record<string, unknown>;
      const applies = docConditionMet(spec.condition, loan);
      const uploaded = applies && status !== "PENDING_UPLOAD";
      const docId = `${claimId}_doc${i}`;
      let currentFileId: string | undefined;

      // A status of "Under review" or "Approved" with nothing behind it is exactly the
      // inconsistency the lender flags as "not a document I uploaded" — so every fabricated
      // status here gets a matching seeded file, the same way IMGC-authored additional documents
      // already do above.
      if (uploaded) {
        currentFileId = `${docId}_f1`;
        documentFiles.push({
          id: currentFileId,
          documentId: docId,
          accountId: account.id,
          originalName: `${spec.name}.pdf`,
          storedPath: "",
          size: 214_016,
          mime: "application/pdf",
          uploadedBy: actorId,
          uploadedByName: actorName,
          uploadedAt: ago(Math.max(1, sc.daysAgo - 1)),
          version: 1,
        });
      }

      claimDocuments.push({
        id: docId,
        accountId: account.id,
        claimId,
        slug: spec.slug,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        required: spec.required && applies,
        multiple: spec.multiple ?? false,
        conditional: Boolean(spec.condition),
        conditionReason: spec.condition
          ? conditionReason(spec.condition)
          : undefined,
        addedBy: "SYSTEM",
        status: applies ? status : "PENDING_UPLOAD",
        version: uploaded ? 1 : 0,
        currentFileId,
        review:
          status === "APPROVED"
            ? {
                decision: "APPROVED",
                by: "usr_emp1",
                byName: "Meera Nair",
                at: ago(1),
                remarks: "Verified.",
                version: 1,
              }
            : undefined,
        active: true,
        createdAt: ago(sc.daysAgo),
      });
    });

    if (sc.query) {
      claimQueries.push({
        id: `qry_${claimId}`,
        claimId,
        reason: sc.query.reason,
        remarks: sc.query.remarks,
        requestedDocuments: [...sc.query.requested],
        raisedById: "usr_emp1",
        raisedByName: "Meera Nair",
        raisedAt: ago(Math.max(1, sc.daysAgo - 3)),
        respondedAt: sc.query.answered ? ago(1) : undefined,
        respondedById: sc.query.answered ? actorId : undefined,
        respondedByName: sc.query.answered ? actorName : undefined,
        responseRemarks: sc.query.answered
          ? "Re-scanned and resubmitted as requested."
          : undefined,
      });
    }
  });

  return { claims, claimQueries };
}
