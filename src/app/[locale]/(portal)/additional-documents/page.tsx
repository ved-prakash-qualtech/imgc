import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileClockIcon,
  RotateCcwIcon,
} from "lucide-react";

import { AdditionalDocumentsClient } from "@/app/[locale]/(portal)/additional-documents/AdditionalDocumentsClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import {
  listCaseOptions,
  listRequirements,
  summariseRequirements,
} from "@/services/portal/requirements.server";

export const dynamic = "force-dynamic";

/** IMGC only — `PortalShell` refuses it for a lender, whose nav has no `additional-documents`. */
export default async function AdditionalDocumentsPage() {
  const session = await requireSession();
  const [rows, cases] = await Promise.all([
    listRequirements(session),
    listCaseOptions(session),
  ]);
  const summary = summariseRequirements(rows);

  return (
    <PortalShell activeKey="additional-documents" title="Additional Documents">
      <div className="space-y-6">
        <CommandBand
          title="Additional documents"
          subtitle="Raise a document requirement against a case, then review what the lender uploads against it"
          stats={[
            {
              icon: <FileClockIcon className="size-4" />,
              label: "Awaiting upload",
              value: String(summary.pendingUpload),
              caption:
                summary.overdue > 0
                  ? `${summary.overdue} past their due date`
                  : "none overdue",
              accent: summary.overdue > 0 ? "rose" : undefined,
            },
            {
              icon: <AlertTriangleIcon className="size-4" />,
              label: "Under review",
              value: String(summary.underReview),
              caption: "waiting on an IMGC decision",
              accent: summary.underReview > 0 ? "amber" : undefined,
            },
            {
              icon: <RotateCcwIcon className="size-4" />,
              label: "Re-upload required",
              value: String(summary.reuploadRequired + summary.rejected),
              caption: `${summary.rejected} rejected outright`,
            },
            {
              icon: <CheckCircle2Icon className="size-4" />,
              label: "Approved",
              value: String(summary.approved),
              caption: `of ${summary.total} raised`,
              accent: "teal",
            },
          ]}
        />

        <AdditionalDocumentsClient rows={rows} cases={cases} />
      </div>
    </PortalShell>
  );
}
