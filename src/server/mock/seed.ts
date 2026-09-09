import { hashPasswordSync } from "@/lib/auth/password";
import {
  CLAIM_TYPES,
  conditionReason,
  docConditionMet,
} from "@/config/claimConfig";
import type {
  Account,
  Claim,
  ClaimDocument,
  ClaimQuery,
  ClaimStatus,
  ClaimTypeKey,
  DocStatus,
  DocumentFile,
  LenderOrg,
  MockDb,
  PasValue,
  Remark,
  User,
} from "@/server/mock/types";

/**
 * Deterministic seed for `.data/imgc-db.json`. Written once, on first read. Delete `.data/` to
 * start over.
 *
 * Generated programmatically (not hand-typed per record) so the demo dataset can be large —
 * 10 lenders, 300 accounts, ~150 claims, 500+ documents, 50+ queries, 500+ audit events — while
 * staying deterministic (index-based, no `Math.random`) and internally consistent: every claim's
 * status history is a real walk through `ClaimStatus`, every document comes from the claim type's
 * own configured checklist (`claimConfig`), and every NPA/DPD/claim/document/query combination is
 * one the existing services (`accounts.server.ts`, `claimFlow.server.ts`, `dashboard.server.ts`)
 * already know how to classify — nothing here introduces a new business rule or a second copy of
 * an existing one.
 */

export const DEMO_IMGC_PASSWORD = "imgc@123";

const NOW = "2026-09-08T09:00:00.000Z";
const ago = (days: number): string =>
  new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
const ahead = (days: number): string =>
  new Date(Date.parse(NOW) + days * 86_400_000).toISOString();

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const PAS_TEMPLATE: ReadonlyArray<{ key: string; label: string }> = [
  { key: "sanctionedAmount", label: "Sanctioned amount" },
  { key: "outstandingPrincipal", label: "Outstanding principal" },
  { key: "overdueAmount", label: "Overdue amount" },
  { key: "emiAmount", label: "EMI amount" },
  { key: "sumInsured", label: "Sum insured (guarantee cover)" },
  { key: "claimAmount", label: "Claim amount lodged" },
];

/* ── lenders ──────────────────────────────────────────────────────────
 * The first two (`org_acme` / `org_northgate`) are kept exactly as before — their ids, domains
 * and first lender user (`arjun@hdfcbank.com`) are what "Demo as Lender" and the real OTP sign-in
 * flow already point at (see `login/actions.ts`). Breaking those would break sign-in, not just
 * the data. Eight more lenders are added alongside them. */
const LENDER_DEFS: ReadonlyArray<{
  id: string;
  name: string;
  domain: string;
  contacts: string[];
}> = [
  { id: "org_acme", name: "HDFC Bank", domain: "hdfcbank.com", contacts: ["claims.desk@hdfcbank.com", "ops.lead@hdfcbank.com"] },
  { id: "org_northgate", name: "ICICI Bank", domain: "icicibank.com", contacts: ["recovery@icicibank.com"] },
  { id: "org_abc", name: "ABC Housing Finance", domain: "abchousing.demo", contacts: ["claims@abchousing.demo"] },
  { id: "org_xyz", name: "XYZ Home Loans", domain: "xyzloans.demo", contacts: ["claims@xyzloans.demo"] },
  { id: "org_pqr", name: "PQR Finance", domain: "pqrfinance.demo", contacts: ["claims@pqrfinance.demo"] },
  { id: "org_sunrise", name: "Sunrise Housing Finance", domain: "sunrisehf.demo", contacts: ["claims@sunrisehf.demo"] },
  { id: "org_national", name: "National Housing Finance", domain: "nationalhf.demo", contacts: ["claims@nationalhf.demo"] },
  { id: "org_prime", name: "Prime Home Finance", domain: "primehf.demo", contacts: ["claims@primehf.demo"] },
  { id: "org_metro", name: "Metro Housing Finance", domain: "metrohf.demo", contacts: ["claims@metrohf.demo"] },
  { id: "org_secure", name: "Secure Housing Finance", domain: "securehf.demo", contacts: ["claims@securehf.demo"] },
];

/**
 * How many accounts each lender gets — deliberately uneven and in the same order as
 * `LENDER_DEFS`, summing to `TOTAL_ACCOUNTS` (300). An even 30-each split (`i % LENDER_DEFS.length`)
 * made every lender's own dashboard/KPI numbers look identical (a lender dropdown that always
 * showed "30" regardless of which lender was picked gave nothing to visually tell selections
 * apart by), so this assigns each lender a contiguous block of that size instead — real book-size
 * variety, still fully deterministic. `decorrelate` doesn't need to change for this: its own
 * spread guarantee comes from `i` increasing by 1 within a contiguous run, which this still is,
 * just no longer exactly 30 long.
 */
const LENDER_ACCOUNT_COUNTS: readonly number[] = [
  42, // HDFC Bank
  35, // ICICI Bank
  18, // ABC Housing Finance
  25, // XYZ Home Loans
  15, // PQR Finance
  22, // Sunrise Housing Finance
  30, // National Housing Finance
  20, // Prime Home Finance
  48, // Metro Housing Finance
  45, // Secure Housing Finance
];

/** Flattens `LENDER_ACCOUNT_COUNTS` into one lender-per-account-index lookup, e.g.
 *  `[HDFC, HDFC, ..., ICICI, ICICI, ..., ...]` — built once, read by raw index in the main loop
 *  below instead of every account re-deriving its own lender from a modulus. */
const LENDER_BY_INDEX: ReadonlyArray<(typeof LENDER_DEFS)[number]> = LENDER_DEFS.flatMap(
  (lender, i) => Array.from({ length: LENDER_ACCOUNT_COUNTS[i]! }, () => lender)
);

/* ── name / place pools — deterministic index-based selection only ──── */
const FIRST_NAMES = [
  "Rajesh", "Kavya", "Imran", "Deepa", "Sneha", "Vikram", "Nikhil", "Ananya",
  "Rohan", "Priyanka", "Arvind", "Neha", "Suresh", "Divya", "Manoj", "Ritu",
  "Karthik", "Pooja", "Vivek", "Shreya", "Abhishek", "Lakshmi", "Fatima",
  "Aditya", "Meenal", "Sameer", "Ishaan", "Kavita", "Rahul", "Anjali",
  "Varun", "Swati", "Gaurav", "Nandini", "Siddharth", "Ritika", "Harish",
  "Bhavna", "Manish", "Tanvi",
] as const;
const LAST_NAMES = [
  "Sharma", "Iyer", "Sheikh", "Menon", "Pillai", "Singh", "Joshi", "Bose",
  "Kapoor", "Reddy", "Kumar", "Kapadia", "Nair", "Krishnan", "Tiwari",
  "Chawla", "Subramaniam", "Agarwal", "Malhotra", "Bhatt", "Ranjan",
  "Narayanan", "Khan", "Verma", "Gupta", "Kulkarni", "Desai", "Rao",
  "Chatterjee", "Bhagat",
] as const;
const REGIONS = ["North", "South", "East", "West", "Central"] as const;
const BRANCHES = [
  "Andheri East", "Koramangala", "Rohini", "Salt Lake", "Banjara Hills",
  "Indiranagar", "Powai", "Malad", "Thane", "Navi Mumbai", "Gurgaon",
  "Noida", "Pune Camp", "Baner", "Whitefield",
] as const;
const PRODUCTS = ["Home Loan", "LAP"] as const;

/**
 * Decorrelates a per-account index from the lender assignment (`i % LENDER_DEFS.length`) before
 * it's used to pick anything from a pool.
 *
 * `i` increases in steps of `LENDER_DEFS.length` (10) *within* one lender's own accounts (i, i+10,
 * i+20, ...) — multiplying `i` by any constant, however "coprime-looking", cannot fix that: for
 * any multiplier `c`, `gcd(c * 10, M) === gcd(10, M)` whenever `gcd(c, M) === 1`, so a pool length
 * that shares a factor with 10 (30, 40, ...) still only ever sees a handful of residues. (An
 * earlier version of this function used `i * 17 + 11` and looked plausible for exactly this
 * reason — it passed a casual read, not a check of the actual per-lender output.)
 *
 * The fix is additive, not multiplicative: `Math.floor(i / LENDER_DEFS.length)` is this lender's
 * own account's position (0, 1, 2, ...) and increases by exactly 1 between consecutive accounts
 * of the *same* lender, so it alone already covers every residue of any modulus across a lender's
 * 30 accounts. A small per-lender offset (`lenderIndex * 7`) then keeps different lenders from
 * all drawing the identical name/DPD/etc. for their Nth account.
 */
function decorrelate(i: number): number {
  const lenderIndex = i % LENDER_DEFS.length;
  const positionWithinLender = Math.floor(i / LENDER_DEFS.length);
  return positionWithinLender + lenderIndex * 7;
}

function borrowerName(i: number): string {
  const k = decorrelate(i);
  return `${FIRST_NAMES[k % FIRST_NAMES.length]} ${LAST_NAMES[(k * 7) % LAST_NAMES.length]}`;
}

/* ── DPD distribution ─────────────────────────────────────────────────
 * A 30-entry pattern tiled across 300 accounts (10x) gives an exact, easy-to-audit split:
 * 40 at 0 DPD, 60 in 1–30, 50 in 31–60, 40 in 61–90, 110 at 90+ — every band comfortably clears
 * the coverage targets, and NPA (`dpd > 90`) vs non-NPA follows the same rule the rest of the
 * app already uses (see `accounts.server.ts`'s `classifyLoanStatus` and the Claim page's
 * NPA-only eligibility filter). */
// 89, 90 and 91 are deliberately all present (not just "some value near 90") — the Claims tab's
// eligibility rule is `dpd > 90`, and this is the exact boundary a regression test has to be able
// to check: 89 and 90 must never show there, 91 must always show there, regardless of NPA.
const DPD_PATTERN: readonly number[] = [
  0, 0, 0, 0,
  5, 10, 15, 20, 25, 30,
  35, 40, 45, 50, 55,
  65, 70, 89, 90,
  91, 110, 125, 140, 155, 170, 185, 200, 220, 245, 270,
];

const ADDITIONAL_DOC_POOL: ReadonlyArray<{
  name: string;
  category: string;
  description: string;
}> = [
  { name: "NOC", category: "Property Document", description: "Latest NOC issued by the concerned authority." },
  { name: "Sanction Letter", category: "Legal Document", description: "Original bank-issued sanction letter." },
  { name: "Possession Letter", category: "Legal Document", description: "Builder or authority possession letter, original scan." },
  { name: "Updated Property Document", category: "Property Document", description: "Latest property document reflecting current ownership." },
  { name: "Customer Declaration", category: "KYC Document", description: "Signed declaration from the borrower." },
];

const REJECTION_REASONS = [
  "Please upload a clearer copy containing all pages.",
  "Document is outdated — please provide the latest version.",
  "Incorrect document uploaded for this requirement.",
  "Document has expired; please re-upload a current one.",
  "Uploaded file does not match the loan details on record.",
] as const;

const QUERY_REASONS: ReadonlyArray<{ reason: string; remarks: string }> = [
  { reason: "Please upload the NOC document.", remarks: "The recall notice references an NOC that was not attached." },
  { reason: "The uploaded statement is illegible.", remarks: "Please provide a bank-stamped copy at 300dpi." },
  { reason: "Please confirm the current outstanding balance.", remarks: "The figure on the statement does not tally with PAS." },
  { reason: "Please provide the updated legal opinion.", remarks: "The one on file predates the last recall notice." },
  { reason: "Please clarify the property valuation date.", remarks: "The technical report is more than 12 months old." },
];

const DECISION_REMARKS: Record<"APPROVED" | "REJECTED" | "CLOSED", readonly string[]> = {
  APPROVED: [
    "Settlement verified. Claim payable in full.",
    "Documents in order. Recommended for payout.",
    "Recovery shortfall confirmed against PAS records.",
  ],
  REJECTED: [
    "Account was not in the guarantee cover period at the date of default.",
    "Recovery does not meet the policy threshold for this claim type.",
    "Claim amount exceeds the sum insured for this account.",
  ],
  CLOSED: [
    "Settlement completed and claim closed in full.",
    "Claim paid and account closed on the guarantee cover.",
  ],
};

/* ── users ────────────────────────────────────────────────────────────
 * IMGC staff and the first HDFC lender user are unchanged from before (see the comment on
 * `LENDER_DEFS`). Two lender users are generated per lender org after that. */
function buildUsers(passwordHash: string): User[] {
  const users: User[] = [
    { id: "usr_emp1", role: "IMGC", name: "Meera Nair", email: "meera.nair@imgc.in", employeeId: "EMP-0001", phone: "+91 98201 44092", passwordHash, createdAt: NOW },
    { id: "usr_emp2", role: "IMGC", name: "Rohit Sharma", email: "rohit.sharma@imgc.in", employeeId: "EMP-0002", phone: "+91 98201 44093", passwordHash, createdAt: NOW },
    { id: "usr_emp3", role: "IMGC", name: "Anita Desai", email: "anita.desai@imgc.in", employeeId: "EMP-0003", phone: "+91 98201 44094", passwordHash, createdAt: NOW },
    { id: "usr_len1", role: "LENDER", name: "Arjun Mehta", email: "arjun@hdfcbank.com", lenderOrgId: "org_acme", createdAt: NOW, createdBy: "usr_emp1" },
    { id: "usr_len2", role: "LENDER", name: "Priya Rao", email: "priya@hdfcbank.com", lenderOrgId: "org_acme", createdAt: NOW, createdBy: "usr_emp1" },
  ];

  // Two users for every lender after HDFC (which already has its pair above).
  let seq = 3;
  LENDER_DEFS.slice(1).forEach((lender, li) => {
    for (let u = 0; u < 2; u += 1) {
      const nameIdx = (li * 2 + u) % FIRST_NAMES.length;
      const name = `${FIRST_NAMES[nameIdx]} ${LAST_NAMES[(nameIdx * 5) % LAST_NAMES.length]}`;
      const email = `${FIRST_NAMES[nameIdx]!.toLowerCase()}${u === 0 ? "" : u}@${lender.domain}`;
      users.push({
        id: `usr_len${seq}`,
        role: "LENDER",
        name,
        email,
        lenderOrgId: lender.id,
        createdAt: NOW,
        createdBy: "usr_emp1",
      });
      seq += 1;
    }
  });

  return users;
}

/* ── one account (loan) record ───────────────────────────────────────── */
function buildAccount(
  i: number,
  lender: (typeof LENDER_DEFS)[number],
  assigned: readonly [string, string]
): Account {
  const k = decorrelate(i);
  const dpd = DPD_PATTERN[k % DPD_PATTERN.length]!;
  const isNpa = dpd > 90;
  // Roughly a seventh of the non-NPA book is write-off-only — overdue collections activity that
  // hasn't (and, for write-off, structurally won't) cross into NPA. The rest are standard.
  const isWriteOff = !isNpa && k % 7 === 0;

  const underConstruction = k % 2 === 1;
  const sanctioned = 1_800_000 + (k % 40) * 350_000;
  const outstanding = Math.round(sanctioned * (0.55 + (k % 5) * 0.08));
  const appDaysAgo = 200 + (k % 24) * 30; // spreads application dates across ~2024–2026
  const loanNo = String(3_002_060_000_000 + i);

  return {
    id: `acc_${1000 + i}`,
    loanNo,
    borrowerName: borrowerName(i),
    lenderOrgId: lender.id,
    product: PRODUCTS[k % PRODUCTS.length]!,
    region: REGIONS[k % REGIONS.length]!,
    branch: BRANCHES[k % BRANCHES.length]!,
    assignedUserId: assigned[0],
    assignedUserName: assigned[1],
    applicationDate: ago(appDaysAgo),
    loanAmount: sanctioned,
    outstandingAmount: outstanding,
    sanctionDate: ago(appDaysAgo + 1400).slice(0, 10),
    disbursementDate: ago(appDaysAgo + 1387).slice(0, 10),
    tenureMonths: 180 + (k % 4) * 60,
    propertyType: k % 3 === 2 ? "Commercial" : "Residential",
    propertyStatus: underConstruction ? "Under Construction" : "Ready to Move",
    propertyStatusAtDisbursal: underConstruction ? "UNDER_CONSTRUCTION" : "READY_TO_MOVE",
    bucket: k % 2 === 0 ? "IMGC" : "LENDER",
    stage: k % 2 === 0 ? "Under IMGC review" : "Document collection",
    claimStatus: "DRAFT",
    npa: isNpa,
    writeOff: isWriteOff,
    dpd,
    pushRecipients: [],
    createdAt: ago(appDaysAgo),
  };
}

/* ── claim-status assignment ─────────────────────────────────────────── */
// Every third account gets a claim (~1/3 of 300 ≈ 100–150 depending on total) — "not every loan
// needs a claim" is the point (see the Claim page's own eligibility filter): some are still
// completely untouched, which is its own real, demonstrable state ("Initiate Claim").
// Length 13 is deliberate — coprime with the `i % 3 !== 2` claim-eligibility check below, so
// every pattern slot (every status, including REJECTED) eventually lands on an included index.
// A pattern length sharing a factor with that modulus (e.g. 15) can silently exclude a status
// from ever being assigned at all.
const CLAIM_STATUS_PATTERN: readonly ClaimStatus[] = [
  "SUBMITTED", "DRAFT", "UNDER_REVIEW", "QUERY_RAISED", "REJECTED",
  "APPROVED", "DOCUMENTS_RESUBMITTED", "DRAFT", "SUBMITTED", "UNDER_REVIEW",
  "CLOSED", "QUERY_RAISED", "SUBMITTED",
];

/** Steps walked before reaching this status — a real, chronological path, never an impossible
 *  jump (e.g. never "NOT_STARTED → APPROVED" with no submission in between). */
const HISTORY_BEFORE: Record<ClaimStatus, readonly ClaimStatus[]> = {
  DRAFT: [],
  SUBMITTED: ["DRAFT"],
  UNDER_REVIEW: ["DRAFT", "SUBMITTED"],
  QUERY_RAISED: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
  DOCUMENTS_RESUBMITTED: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED"],
  APPROVED: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
  REJECTED: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
  CLOSED: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"],
  QUERIED: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"],
  ACTIVE: [],
};

const DAYS_AGO_BY_STATUS: Record<ClaimStatus, number> = {
  DRAFT: 1,
  SUBMITTED: 7,
  UNDER_REVIEW: 12,
  QUERY_RAISED: 16,
  DOCUMENTS_RESUBMITTED: 20,
  APPROVED: 26,
  REJECTED: 22,
  CLOSED: 40,
  QUERIED: 12,
  ACTIVE: 0,
};

const SAMPLE_FIELDS: Record<string, string> = {
  claimsProgram: "Developer Under Construction>85%",
  ineligibleClaim: "No",
  coApplicantName: "Sunita Sharma",
  borrowerMobile: "9820012345",
  borrowerEmail: "borrower@example.com",
  borrowerPan: "ABCDE1234F",
  sanctionedAmount: "4500000",
  disbursedAmount: "4500000",
  disbursementDate: ago(1600).slice(0, 10),
  loanTenureMonths: "240",
  interestRate: "9.25",
  emiAmount: "42000",
  currentOutstanding: "3240000",
  npaDate: ago(120).slice(0, 10),
  lastEmiDate: ago(210).slice(0, 10),
  daysPastDue: "210",
  assetClassification: "Doubtful 1",
  defaultReason: "Loss of employment",
  recallNoticeDate: ago(90).slice(0, 10),
  legalNoticeDate: ago(60).slice(0, 10),
  sarfaesiStatus: "13(2) notice served",
  recoverySuitFiled: "No",
  claimAmount: "2400000",
  principalOutstanding: "2250000",
  interestOutstanding: "150000",
  recoveryToDate: "150000",
  contactPerson: "Arjun Mehta",
  contactDesignation: "Manager - Recovery",
  contactPhone: "9820098200",
  contactEmail: "arjun@hdfcbank.com",
  remarks: "Borrower unreachable since the second recall notice.",
  recoveryMode: "One-time settlement",
  recoveryClosedDate: ago(30).slice(0, 10),
  grossRecovered: "1850000",
  recoveryExpenses: "120000",
  netLossClaimed: "550000",
  subsequentApprovedBy: "Recovery Committee",
};

export function buildSeed(): MockDb {
  const lenderOrgs: LenderOrg[] = LENDER_DEFS.map((l) => ({
    id: l.id,
    name: l.name,
    emailDomain: l.domain,
    contactEmails: l.contacts,
  }));

  const passwordHash = hashPasswordSync(DEMO_IMGC_PASSWORD);
  const users = buildUsers(passwordHash);
  const lenderUsersByOrg = new Map<string, User[]>();
  users
    .filter((u) => u.role === "LENDER")
    .forEach((u) => {
      const list = lenderUsersByOrg.get(u.lenderOrgId!) ?? [];
      list.push(u);
      lenderUsersByOrg.set(u.lenderOrgId!, list);
    });

  // Derived from `LENDER_ACCOUNT_COUNTS`, not restated — the two can never silently drift apart.
  const TOTAL_ACCOUNTS = LENDER_BY_INDEX.length;
  const accounts: Account[] = [];
  const pasValues: PasValue[] = [];
  const claimDocuments: ClaimDocument[] = [];
  const documentFiles: DocumentFile[] = [];
  const claims: Claim[] = [];
  const claimQueries: ClaimQuery[] = [];
  const remarks: Remark[] = [];
  const auditEvents: AuditEventDraft[] = [];

  const claimCountByPrefix: Record<string, number> = {};

  for (let i = 0; i < TOTAL_ACCOUNTS; i += 1) {
    const lender = LENDER_BY_INDEX[i]!;
    // Every pool-choice below reads `k`, not `i` — see `decorrelate`'s comment: with 10 lenders,
    // a raw `i % N` for any N that shares a factor with 10 gives every account at one lender the
    // same handful of values (this is how the first version of this generator silently produced
    // near-identical DPD/name spreads per lender until it was caught in review).
    const k = decorrelate(i);
    const imgcAssignee: readonly [string, string] =
      k % 3 === 0 ? ["usr_emp1", "Meera Nair"] : k % 3 === 1 ? ["usr_emp2", "Rohit Sharma"] : ["usr_emp3", "Anita Desai"];

    const account = buildAccount(i, lender, imgcAssignee);

    // PAS values — every account, regardless of claim status (PAS is the underlying book, not a
    // claim-scoped concept).
    const amounts: Record<string, number> = {
      sanctionedAmount: account.loanAmount,
      outstandingPrincipal: account.outstandingAmount,
      overdueAmount: Math.round(account.outstandingAmount * 0.11),
      emiAmount: Math.round(account.loanAmount / account.tenureMonths),
      sumInsured: Math.round(account.loanAmount * 0.9),
      claimAmount: account.outstandingAmount,
    };
    PAS_TEMPLATE.forEach((t) => {
      pasValues.push({
        id: `pas_${account.id}_${t.key}`,
        accountId: account.id,
        key: t.key,
        label: t.label,
        value: inr(amounts[t.key] ?? 0),
        source: "PAS",
        updatedAt: ago(2),
        updatedBy: "PAS",
      });
    });

    // Every third account gets a claim — the other two-thirds are genuinely untouched
    // ("Initiate Claim"), which is its own real state, not an omission.
    const hasClaim = i % 3 !== 2;
    if (hasClaim) {
      const status = CLAIM_STATUS_PATTERN[k % CLAIM_STATUS_PATTERN.length]!;
      const type: ClaimTypeKey = k % 2 === 0 ? "INITIAL" : "SUBSEQUENT";
      const config = CLAIM_TYPES[type];
      claimCountByPrefix[config.prefix] = (claimCountByPrefix[config.prefix] ?? 0) + 1;
      const claimId = `clm_${String(i + 1).padStart(4, "0")}`;
      const claimNo = `${config.prefix}-2026-${String(claimCountByPrefix[config.prefix]).padStart(5, "0")}`;

      const lenderUser = lenderUsersByOrg.get(lender.id)?.[0];
      const actorId = lenderUser?.id ?? "usr_len1";
      const actorName = lenderUser?.name ?? "Arjun Mehta";
      const imgcId = imgcAssignee[0];
      const imgcName = imgcAssignee[1];

      // A subset of APPROVED claims went through a query loop first — the "query then approved"
      // path from the query-flow coverage requirement, distinct from a straight approval.
      const wentThroughQuery = status === "APPROVED" && k % 4 === 0;
      const history = wentThroughQuery
        ? (["DRAFT", "SUBMITTED", "UNDER_REVIEW", "QUERY_RAISED", "DOCUMENTS_RESUBMITTED", "UNDER_REVIEW"] as const)
        : HISTORY_BEFORE[status];
      // `k % 15`, not `k % 5` — a wider spread here is what gives the "Aging overview" widget on
      // the Dashboard (buildDashboardSummary's `aging`, keyed off each open claim's own
      // `lastUpdatedAt`) real coverage across all four of its day-bands instead of every open
      // claim landing within the same few-day window.
      const daysAgo = DAYS_AGO_BY_STATUS[status] + (wentThroughQuery ? 12 : 0) + (k % 15);

      const steps = [...history, status];
      const statusHistory = steps.map((s, si) => {
        const imgcSide = s !== "DRAFT" && s !== "SUBMITTED" && s !== "DOCUMENTS_RESUBMITTED";
        return {
          status: s,
          at: ago(Math.max(0, daysAgo - si * (daysAgo / (steps.length + 1)))),
          byId: imgcSide ? imgcId : actorId,
          byName: imgcSide ? imgcName : actorName,
          byRole: (imgcSide ? "IMGC" : "LENDER") as "IMGC" | "LENDER",
        };
      });

      const fieldsComplete = status !== "DRAFT";
      const decisionOutcome: "APPROVED" | "REJECTED" | "CLOSED" | undefined =
        status === "APPROVED" || status === "REJECTED" || status === "CLOSED" ? status : undefined;

      claims.push({
        id: claimId,
        claimNo,
        accountId: account.id,
        claimType: type,
        status,
        fields: fieldsComplete
          ? Object.fromEntries(config.fields.map((f) => [f.id, SAMPLE_FIELDS[f.id] ?? ""]))
          : { contactPerson: actorName },
        statusHistory,
        createdById: actorId,
        createdByName: actorName,
        createdAt: ago(daysAgo),
        submittedAt: status === "DRAFT" ? undefined : ago(Math.max(0, daysAgo - 1)),
        lastUpdatedAt: statusHistory[statusHistory.length - 1]?.at ?? ago(daysAgo),
        draftSaved: true,
        bucket: status === "DRAFT" || status === "QUERY_RAISED" ? "LENDER" : "IMGC",
        decision: decisionOutcome
          ? {
              outcome: decisionOutcome,
              byId: imgcId,
              byName: imgcName,
              at: ago(1),
              remarks: DECISION_REMARKS[decisionOutcome][k % DECISION_REMARKS[decisionOutcome].length]!,
            }
          : undefined,
      });

      account.claimStatus = status === "QUERY_RAISED" ? "QUERIED" : status;
      account.stage =
        status === "APPROVED" ? "Claim approved"
          : status === "REJECTED" ? "Claim rejected"
          : status === "CLOSED" ? "Claim closed"
          : status === "QUERY_RAISED" ? "Query raised with the lender"
          : account.bucket === "IMGC" ? "Under IMGC review" : "Document collection";
      account.submittedAt = status === "DRAFT" ? undefined : ago(Math.max(0, daysAgo - 1));

      if (decisionOutcome) {
        remarks.push({
          id: `rmk_${claimId}`,
          accountId: account.id,
          authorId: imgcId,
          authorName: imgcName,
          authorRole: "IMGC",
          body: `Claim ${decisionOutcome.toLowerCase()}: ${DECISION_REMARKS[decisionOutcome][k % DECISION_REMARKS[decisionOutcome].length]!}`,
          createdAt: ago(1),
        });
      }

      // Approved-doc depth per stage — how much of the checklist is already through review.
      const approvedDocs =
        status === "DRAFT" ? 0
          : status === "SUBMITTED" ? 0
          : status === "REJECTED" ? 1
          : status === "APPROVED" || status === "CLOSED" ? 99
          : 2;

      const hasOpenQuery = status === "QUERY_RAISED";
      // Also true for a fraction of plain UNDER_REVIEW claims — a claim can be back under review
      // after an earlier query was already answered, a real and common state.
      const hasResolvedQuery =
        status === "DOCUMENTS_RESUBMITTED" || wentThroughQuery || (status === "UNDER_REVIEW" && k % 6 === 0);
      const q = QUERY_REASONS[k % QUERY_REASONS.length]!;
      const loan = account as unknown as Record<string, unknown>;

      config.documents.forEach((spec, di) => {
        const applies = docConditionMet(spec.condition, loan);
        const isQueriedDoc = (hasOpenQuery || hasResolvedQuery) && di === 0;
        const rejected = status === "REJECTED" && di === 0;
        const approved = di < approvedDocs;

        const docStatus: DocStatus = isQueriedDoc && hasOpenQuery
          ? "REUPLOAD_REQUIRED"
          : rejected
            ? "REJECTED"
            : approved
              ? "APPROVED"
              : status === "DRAFT"
                ? "PENDING_UPLOAD"
                : "UNDER_REVIEW";

        const uploaded = applies && docStatus !== "PENDING_UPLOAD";
        const docId = `${claimId}_doc${di}`;
        let currentFileId: string | undefined;

        if (uploaded) {
          currentFileId = `${docId}_f1`;
          documentFiles.push({
            id: currentFileId,
            documentId: docId,
            accountId: account.id,
            originalName: `${spec.name}.pdf`,
            storedPath: "",
            size: 200_000 + di * 7_000,
            mime: "application/pdf",
            uploadedBy: actorId,
            uploadedByName: actorName,
            uploadedAt: ago(Math.max(1, daysAgo - 1)),
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
          conditionReason: spec.condition ? conditionReason(spec.condition) : undefined,
          addedBy: "SYSTEM",
          status: applies ? docStatus : "PENDING_UPLOAD",
          version: uploaded ? 1 : 0,
          currentFileId,
          rejection:
            docStatus === "REJECTED"
              ? { at: ago(Math.max(1, daysAgo - 2)), by: imgcName, reason: REJECTION_REASONS[k % REJECTION_REASONS.length]! }
              : undefined,
          review:
            docStatus === "APPROVED"
              ? { decision: "APPROVED", by: imgcId, byName: imgcName, at: ago(1), remarks: "Verified.", version: 1 }
              : docStatus === "REJECTED"
                ? { decision: "REJECTED", by: imgcId, byName: imgcName, at: ago(Math.max(1, daysAgo - 2)), remarks: REJECTION_REASONS[k % REJECTION_REASONS.length]!, version: 1 }
                : undefined,
          active: true,
          createdAt: ago(daysAgo),
        });
      });

      // Queries — an open one for QUERY_RAISED, a resolved one for DOCUMENTS_RESUBMITTED / the
      // query-then-approved path.
      if (hasOpenQuery || hasResolvedQuery) {
        const requestedDoc = config.documents[0]?.name ?? "Loan Account Statement";
        // Anchor the query to the claim's own status history wherever a real QUERY_RAISED /
        // DOCUMENTS_RESUBMITTED step exists, so "Claim History" and the query thread agree on
        // when it happened — an independently-computed date drifted earlier than "Submitted"
        // for some claims, which read as the query existing before the claim was even filed.
        // The one case with no such step (a resolved query on a plain UNDER_REVIEW claim, which
        // moved on without leaving a QUERY_RAISED entry behind) falls back to a date between
        // "Submitted" and the current "Under review" entry.
        const queryRaisedEntry = statusHistory.find((h) => h.status === "QUERY_RAISED");
        const docsResubmittedEntry = statusHistory.find((h) => h.status === "DOCUMENTS_RESUBMITTED");
        const raisedAtIso = queryRaisedEntry?.at ?? ago(Math.round(daysAgo * 0.65));
        const respondedAtIso = docsResubmittedEntry?.at ?? ago(Math.round(daysAgo * 0.55));
        claimQueries.push({
          id: `qry_${claimId}`,
          claimId,
          reason: q.reason,
          remarks: q.remarks,
          requestedDocuments: [requestedDoc],
          raisedById: imgcId,
          raisedByName: imgcName,
          raisedAt: raisedAtIso,
          // `ago(n)` with a positive `n` is a past date — that's what "overdue" means for a due
          // date. Half of the open queries are overdue, half still have time to respond.
          dueDate: hasOpenQuery ? (k % 2 === 0 ? ago(5) : ahead(4)) : undefined,
          respondedAt: hasResolvedQuery ? respondedAtIso : undefined,
          respondedById: hasResolvedQuery ? actorId : undefined,
          respondedByName: hasResolvedQuery ? actorName : undefined,
          responseRemarks: hasResolvedQuery ? "Re-scanned and resubmitted as requested." : undefined,
        });
      }

      // Additional (IMGC-authored) documents — roughly one in five claimed accounts, 1–2 each,
      // some already decided so the retention/reinstatement screen has real rows to show.
      if (k % 5 === 0) {
        const extraCount = 1 + (k % 2);
        for (let e = 0; e < extraCount; e += 1) {
          const pick = ADDITIONAL_DOC_POOL[(k + e) % ADDITIONAL_DOC_POOL.length]!;
          const docId = `doc_${account.id}_add${e}`;
          const extraStatus: DocStatus =
            e === 0 && k % 15 === 0 ? "REJECTED" : k % 4 === 0 ? "APPROVED" : k % 4 === 1 ? "UNDER_REVIEW" : "PENDING_UPLOAD";
          let currentFileId: string | undefined;
          if (extraStatus !== "PENDING_UPLOAD") {
            currentFileId = `${docId}_f1`;
            documentFiles.push({
              id: currentFileId,
              documentId: docId,
              accountId: account.id,
              originalName: `${pick.name}.pdf`,
              storedPath: "",
              size: 180_000,
              mime: "application/pdf",
              uploadedBy: actorId,
              uploadedByName: actorName,
              uploadedAt: ago(6),
              version: 1,
            });
          }
          // Three retention scenarios, and a reinstatement state on top of them — cycling by
          // `Math.floor(k / 15)`, not `k` itself: this whole branch only ever fires when `k` is a
          // multiple of 15, so `k % 3` (or `% 4`) would always land on the exact same remainder
          // and every rejected document would get the identical "days left"/reinstatement state
          // (this is the same class of bug `decorrelate` exists to avoid, just re-introduced
          // locally here — a reminder that the fix has to travel with wherever the correlated
          // modulus is used, not just live in one shared helper).
          const cycle = Math.floor(k / 15);
          // Recently rejected (eligible), rejected ~2 months ago (still eligible), rejected 80
          // days ago (retention days-left drops to 10 — the "expiring within 14 days" case), and
          // rejected >3 months ago (past the 90-day window, expired) — every retention-page
          // scenario the application's own 90-day window (see `retention.ts`) can produce.
          const rejectedDaysAgo = [15, 60, 80, 100][cycle % 4]!;
          // No reinstatement / requested (awaiting IMGC's decision) / already approved (held) —
          // so the retention screen's own three non-"total" KPI tiles all have real rows. Reads
          // `(cycle + 1) % 3`, not `cycle % something` — deriving both this and `rejectedDaysAgo`
          // from the same modulus of the same variable would correlate them (e.g. every
          // "expiring within 14 days" row always landing on "held", which zeroes out that count
          // exactly the way the uncorrected version above did).
          const reinstateState = (cycle + 1) % 3;
          claimDocuments.push({
            id: docId,
            accountId: account.id,
            name: pick.name,
            required: true,
            addedBy: "IMGC",
            addedByName: imgcName,
            status: extraStatus,
            category: pick.category,
            description: pick.description,
            applicableProduct: account.product,
            applicableCaseType: "Initial Claim",
            dueDate: extraStatus === "PENDING_UPLOAD" ? ahead(7) : undefined,
            priority: "NORMAL",
            active: true,
            version: extraStatus === "PENDING_UPLOAD" ? 0 : 1,
            currentFileId,
            rejection:
              extraStatus === "REJECTED"
                ? {
                    at: ago(rejectedDaysAgo),
                    by: imgcName,
                    reason: REJECTION_REASONS[(k + e) % REJECTION_REASONS.length]!,
                    reinstate:
                      reinstateState === 1
                        ? { status: "REQUESTED", requestedBy: actorName, requestedAt: ago(Math.max(1, rejectedDaysAgo - 3)) }
                        : reinstateState === 2
                          ? {
                              status: "APPROVED",
                              requestedBy: actorName,
                              requestedAt: ago(Math.max(1, rejectedDaysAgo - 3)),
                              decidedBy: imgcName,
                              decidedAt: ago(Math.max(1, rejectedDaysAgo - 1)),
                            }
                          : undefined,
                  }
                : undefined,
            review:
              extraStatus === "APPROVED"
                ? { decision: "APPROVED", by: imgcId, byName: imgcName, at: ago(2), remarks: "Verified.", version: 1 }
                : extraStatus === "REJECTED"
                  ? { decision: "REJECTED", by: imgcId, byName: imgcName, at: ago(rejectedDaysAgo), remarks: REJECTION_REASONS[(k + e) % REJECTION_REASONS.length]!, version: 1 }
                  : undefined,
            createdAt: ago(daysAgo + 4),
          });
        }
      }

      // Audit trail — one entry per real status transition, plus a document-decision entry per
      // decided document. Derived from the claim/documents just built, not a separate hard-coded
      // "recent activity" list.
      statusHistory.forEach((h, hi) => {
        if (hi === 0) return; // the first entry is the claim's creation, not a "change"
        auditEvents.push({
          accountId: account.id,
          at: h.at,
          actorId: h.byId,
          actorName: h.byName,
          actorRole: h.byRole,
          type: "CLAIM_STATUS_CHANGED",
          summary: `Claim ${h.status.toLowerCase().replace(/_/g, " ")}`,
          meta: { status: h.status },
        });
      });
      if (account.submittedAt) {
        auditEvents.push({
          accountId: account.id,
          at: account.submittedAt,
          actorId: actorId,
          actorName: actorName,
          actorRole: "LENDER",
          type: "CLAIM_SUBMITTED",
          summary: `Claim ${claimNo} submitted`,
        });
      }
    } else {
      account.stage = "Document collection";
    }

    accounts.push(account);
  }

  // A guaranteed block of "Initiate Claim"-eligible accounts for the demo lender (HDFC Bank).
  // The main loop above already produces NPA-and-claimless accounts (`i % 3 !== 2` crossed with
  // `dpd > 90` from `DPD_PATTERN`), but which specific accounts land in that intersection is a
  // side effect of `decorrelate`'s spread, not something this file promises a count for — and it
  // isn't scoped per lender. Demoing "Initiate Claim" needs a few rows that are *certain* to be
  // eligible for whichever lender is signed in, so these are hand-built rather than left to fall
  // out of the main pattern: no claim record at all, `npa: true`, on the same lender the "Demo as
  // Lender" flow signs into (`org_acme` / HDFC Bank, see the comment on `LENDER_DEFS`).
  const EXTRA_INITIATE_ELIGIBLE = 12;
  for (let e = 0; e < EXTRA_INITIATE_ELIGIBLE; e += 1) {
    const i = TOTAL_ACCOUNTS + e; // continues the index sequence — ids/loan numbers stay unique
    const account = buildAccount(i, LENDER_DEFS[0]!, ["usr_len1", "Arjun Mehta"]);
    account.npa = true;
    account.writeOff = false;
    account.dpd = DPD_PATTERN[19 + (e % (DPD_PATTERN.length - 19))]!; // always one of the >90 entries
    account.stage = "Document collection";

    const amounts: Record<string, number> = {
      sanctionedAmount: account.loanAmount,
      outstandingPrincipal: account.outstandingAmount,
      overdueAmount: Math.round(account.outstandingAmount * 0.11),
      emiAmount: Math.round(account.loanAmount / account.tenureMonths),
      sumInsured: Math.round(account.loanAmount * 0.9),
      claimAmount: account.outstandingAmount,
    };
    PAS_TEMPLATE.forEach((t) => {
      pasValues.push({
        id: `pas_${account.id}_${t.key}`,
        accountId: account.id,
        key: t.key,
        label: t.label,
        value: inr(amounts[t.key] ?? 0),
        source: "PAS",
        updatedAt: ago(2),
        updatedBy: "PAS",
      });
    });

    accounts.push(account);
  }

  // One document-decision audit entry per document that has actually been decided.
  claimDocuments.forEach((d) => {
    if (!d.review) return;
    auditEvents.push({
      accountId: d.accountId,
      at: d.review.at,
      actorId: d.review.by,
      actorName: d.review.byName,
      actorRole: "IMGC",
      type: d.review.decision === "APPROVED" ? "DOC_APPROVED" : "DOC_REJECTED",
      summary: `"${d.name}" ${d.review.decision === "APPROVED" ? "approved" : "rejected"}`,
    });
  });

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
    remarks,
    auditEvents: auditEvents.map((e, i) => ({ id: `aud_${String(i + 1).padStart(4, "0")}`, ...e })),
    notifications: [],
  };
}

/** Shape built up during generation, before the sequential `id` is assigned. */
type AuditEventDraft = {
  accountId: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: "IMGC" | "LENDER" | "SYSTEM";
  type:
    | "DOC_UPLOADED"
    | "DOC_STATUS_CHANGED"
    | "DOC_REQUIREMENT_ADDED"
    | "REMARK_ADDED"
    | "PAS_VALUE_UPDATED"
    | "BUCKET_SHIFTED"
    | "CLAIM_SUBMITTED"
    | "CLAIM_STATUS_CHANGED"
    | "REINSTATE_REQUESTED"
    | "REINSTATE_DECIDED"
    | "RETENTION_PURGED"
    | "DOC_REQUIREMENT_UPDATED"
    | "DOC_APPROVED"
    | "DOC_REJECTED"
    | "DOC_REUPLOAD_REQUESTED"
    | "DOC_REACTIVATED";
  summary: string;
  meta?: Record<string, string>;
};
