import { Panel } from "@/components/portal/Panel";

/**
 * The claim-level remarks, read-only: the lender's remark from Initiate Claim and IMGC's note from
 * Submit for Review. Shown at the foot of both sides' claim screens, and not at all when neither
 * side has written anything — an empty "Remarks" box says nothing.
 */
export function ClaimRemarksPanel({
  lender,
  imgc,
  decision,
}: Readonly<{ lender?: string; imgc?: string; decision?: string }>) {
  const items = [
    ["Lender", lender?.trim()],
    ["IMGC", imgc?.trim()],
    ["IMGC decision", decision?.trim()],
  ].filter((i): i is [string, string] => Boolean(i[1]));
  if (items.length === 0) return null;
  return (
    <Panel title="Remarks">
      <div className="flex flex-col gap-1.5 px-4 py-3 text-[12.5px]">
        {items.map(([who, text]) => (
          <p key={who} className="whitespace-pre-wrap text-neutral-800">
            <span className="mr-1.5 font-semibold text-neutral-500">{who}:</span>
            {text}
          </p>
        ))}
      </div>
    </Panel>
  );
}
