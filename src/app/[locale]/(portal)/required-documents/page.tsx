import {
  CheckCircle2Icon,
  FileClockIcon,
  RotateCcwIcon,
  UploadCloudIcon,
} from "lucide-react";

import { RequiredDocumentsClient } from "@/app/[locale]/(portal)/required-documents/RequiredDocumentsClient";
import { CommandBand } from "@/components/portal/CommandBand";
import { PortalShell } from "@/components/portal/PortalShell";
import { requireSession } from "@/lib/auth/appSession";
import {
  listRequirements,
  summariseRequirements,
} from "@/services/portal/requirements.server";

export const dynamic = "force-dynamic";

/** Lender only — IMGC's nav has no `required-documents`, so the shell refuses it for them. */
export default async function RequiredDocumentsPage() {
  const session = await requireSession();
  const rows = await listRequirements(session);
  const summary = summariseRequirements(rows);

  const toDo = summary.pendingUpload + summary.reuploadRequired + summary.rejected;

  return (
    <PortalShell activeKey="required-documents" title="Required Documents">
      <div className="space-y-6">
        <CommandBand
          title="Required documents"
          subtitle="Additional documents IMGC has asked your organisation for, grouped by case"
          stats={[
            {
              icon: <UploadCloudIcon className="size-4" />,
              label: "Waiting on you",
              value: String(toDo),
              caption:
                summary.overdue > 0
                  ? `${summary.overdue} past the due date`
                  : "nothing overdue",
              accent: summary.overdue > 0 ? "rose" : toDo > 0 ? "amber" : undefined,
            },
            {
              icon: <RotateCcwIcon className="size-4" />,
              label: "Re-upload required",
              value: String(summary.reuploadRequired + summary.rejected),
              caption: "IMGC asked for a correction",
            },
            {
              icon: <FileClockIcon className="size-4" />,
              label: "With IMGC",
              value: String(summary.underReview),
              caption: "under review — nothing to do",
            },
            {
              icon: <CheckCircle2Icon className="size-4" />,
              label: "Approved",
              value: String(summary.approved),
              caption: `of ${summary.total} requested`,
              accent: "teal",
            },
          ]}
        />

        <RequiredDocumentsClient rows={rows} />
      </div>
    </PortalShell>
  );
}
