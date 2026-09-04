import { hashPasswordSync } from "@/lib/auth/password";
import { CLAIM_TYPES } from "@/config/claimConfig";
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

const STANDARD_DOCUMENTS: ReadonlyArray<{ name: string; required: boolean }> = [
  { name: "Claim Intimation Form", required: true },
  { name: "Loan Account Statement", required: true },
  { name: "Legal / Recall Notice", required: true },
  { name: "Insurance Policy Copy", required: false },
];

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
}> = [
  {
    id: "acc_100245",
    loanNo: "APP-100245",
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
    loanNo: "APP-100246",
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
    loanNo: "APP-100247",
    borrowerName: "Imran Sheikh",
    orgId: "org_northgate",
    product: "Affordable Housing",
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
    loanNo: "APP-100248",
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
    loanNo: "APP-100249",
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
    loanNo: "APP-100250",
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
    loanNo: "APP-100251",
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
    loanNo: "APP-100252",
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
    loanNo: "APP-100253",
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
    loanNo: "APP-100254",
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
    const isNpa = c.id === "acc_100254" ? true : i % 3 !== 1;
    const isWriteOff = c.id === "acc_100254" ? false : i % 3 === 1;

    accounts.push({
      npa: isNpa,
      writeOff: isWriteOff,
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

    // The standard checklist every case carries.
    STANDARD_DOCUMENTS.forEach((d, di) => {
      claimDocuments.push({
        id: `doc_${c.id}_std${di}`,
        accountId: c.id,
        name: d.name,
        required: d.required,
        addedBy: "SYSTEM",
        status: "PENDING_UPLOAD",
        version: 0,
        active: true,
        createdAt: ago(c.appDaysAgo),
      });
    });

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

  const { claims, claimQueries } = buildClaims(accounts, claimDocuments);

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
    type: "SETTLEMENT",
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
    type: "AUCTION",
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
    type: "SETTLEMENT",
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
  npaDate: ago(120).slice(0, 10),
  claimAmount: "2400000",
  recoveryToDate: "150000",
  contactPerson: "Arjun Mehta",
  remarks: "Borrower unreachable since the second recall notice.",
  defaultReason: "Loss of employment",
  lastEmiDate: ago(210).slice(0, 10),
  settlementAmount: "1850000",
  settlementDate: ago(45).slice(0, 10),
  shortfall: "550000",
  auctionDate: ago(60).slice(0, 10),
  reservePrice: "2100000",
  realisedAmount: "1780000",
  possessionType: "Physical possession",
};

function buildClaims(
  accounts: Account[],
  claimDocuments: ClaimDocument[]
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

      claimDocuments.push({
        id: `${claimId}_doc${i}`,
        accountId: account.id,
        claimId,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        required: spec.required,
        addedBy: "SYSTEM",
        status,
        version: status === "PENDING_UPLOAD" ? 0 : 1,
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
