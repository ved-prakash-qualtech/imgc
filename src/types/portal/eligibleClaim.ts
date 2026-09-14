import type {
  ClaimAction,
  ClaimStatus,
  ClaimStatusEntry,
} from "@/server/mock/types";

export type EligibleClaim = Readonly<{
  id: string;
  claimNo: string;
  status: ClaimStatus;
  bucket: "IMGC" | "LENDER";
  hasProgress: boolean;
  lastUpdatedAt: string;
  createdAt: string;
  submittedAt?: string;
  statusHistory: ClaimStatusEntry[];
}>;

export interface EligibleRow {
  id: string;
  loanNo: string;
  borrowerName: string;
  product: string;
  loanAmount: number;
  outstandingAmount: number;
  lenderOrgId: string;
  lenderOrgName: string;
  npa: boolean;
  isActive?: boolean;
  loanStatus: string;
  dpd?: number;
  submittedAt?: string;
  claim: EligibleClaim | null;
  claimAction: ClaimAction;
  claimReason?: string;
}
