import { Panel } from "@/components/portal/Panel";
import type { Claim, Remark } from "@/server/mock/types";

export type ClaimRemarkItem = Readonly<{
  text: string;
  /** ISO timestamp — shown next to the remark wherever it's known. Older data recorded before
   *  this existed has none, and still renders correctly with just the text. */
  at?: string;
  byName?: string;
}>;

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Turns a claim's three remark slots into what `ClaimRemarksPanel` renders, pulling the date/time
 * and author from wherever each one is actually recorded:
 *
 * - Lender's initiation remark is a real `Remark` row (`source: "CLAIM_INITIATION"`), so its own
 *   `createdAt`/`authorName` are exact.
 * - IMGC's review note is stamped onto the claim's own fields the moment it's set
 *   (`__imgcReviewRemarkAt`/`__imgcReviewRemarkByName`) — see `startClaimReview`.
 * - IMGC's decision remark is read straight off `claim.decision`, which already carries `at` and
 *   `byName` for the same Approve/Reject that set the remark — one source, so it can't drift.
 *
 * A claim written before any of this existed still has the bare text on `claim.fields`; that falls
 * back to showing with no date rather than being dropped.
 */
export function buildClaimRemarkItems(
  claim: Pick<Claim, "id" | "fields" | "decision"> | null,
  remarks: readonly Remark[]
): Readonly<{
  lender?: ClaimRemarkItem;
  imgc?: ClaimRemarkItem;
  decision?: ClaimRemarkItem;
}> {
  if (!claim) return {};

  const initiation = remarks.find(
    (r) => r.claimId === claim.id && r.source === "CLAIM_INITIATION"
  );
  const lender = initiation
    ? {
        text: initiation.body,
        at: initiation.createdAt,
        byName: initiation.authorName,
      }
    : claim.fields.__initiationRemark
      ? { text: claim.fields.__initiationRemark }
      : undefined;

  const imgc = claim.fields.__imgcReviewRemark
    ? {
        text: claim.fields.__imgcReviewRemark,
        at: claim.fields.__imgcReviewRemarkAt,
        byName: claim.fields.__imgcReviewRemarkByName,
      }
    : undefined;

  const decision = claim.decision?.remarks
    ? {
        text: claim.decision.remarks,
        at: claim.decision.at,
        byName: claim.decision.byName,
      }
    : claim.fields.__imgcDecisionRemark
      ? { text: claim.fields.__imgcDecisionRemark }
      : undefined;

  return { lender, imgc, decision };
}

/**
 * The claim-level remarks, read-only: the lender's remark from Initiate Claim, IMGC's note from
 * Submit for Review, and IMGC's decision remark — each shown with who wrote it and when, wherever
 * that's known. Shown at the foot of both sides' claim screens, and not at all when neither side
 * has written anything — an empty "Remarks" box says nothing.
 */
export function ClaimRemarksPanel({
  lender,
  imgc,
  decision,
}: Readonly<{
  lender?: ClaimRemarkItem;
  imgc?: ClaimRemarkItem;
  decision?: ClaimRemarkItem;
}>) {
  const slots: [string, ClaimRemarkItem | undefined][] = [
    ["Lender", lender],
    ["IMGC", imgc],
    ["IMGC decision", decision],
  ];
  const items = slots.filter((i): i is [string, ClaimRemarkItem] =>
    Boolean(i[1]?.text?.trim())
  );
  if (items.length === 0) return null;
  return (
    <Panel title="Remarks">
      <div className="flex flex-col gap-3 px-4 py-3 text-[12.5px]">
        {items.map(([who, item]) => (
          <div key={who}>
            <p className="whitespace-pre-wrap text-neutral-800">
              <span className="mr-1.5 font-semibold text-neutral-500">
                {who}:
              </span>
              {item.text.trim()}
            </p>
            {(item.at ?? item.byName) && (
              <p className="mt-0.5 text-[11px] text-neutral-400">
                {item.byName}
                {item.byName && item.at && " · "}
                {item.at && when(item.at)}
              </p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
