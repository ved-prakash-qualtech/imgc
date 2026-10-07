/* eslint-disable react-perf/jsx-no-new-array-as-prop -- the stats array is built once per request from literals declared in this file. */
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileClockIcon,
  RotateCcwIcon,
} from "lucide-react";

import { AdditionalDocumentsClient } from "@/app/[locale]/(portal)/additional-documents/AdditionalDocumentsClient";
import { CommandBand } from "@imgc/features/portal/CommandBand";
import type React from "react";
import { ROUTES } from "@imgc/constants/route";
import { redirectTo } from "@imgc/lib/zoneRedirect";

import { getTranslations } from "next-intl/server";
import { PortalShell } from "@imgc/features/portal/PortalShell";
import { requireSession } from "@imgc/lib/auth/appSession";
import {
  listCaseOptions,
  listRequirements,
  summariseRequirements,
} from "@imgc/data/services/portal/requirements.server";

export const dynamic = "force-dynamic";

/** IMGC only — a lender is sent back to their dashboard rather than shown a Forbidden page. */
export default async function AdditionalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "IMGC") redirectTo(ROUTES.claimDashboard);
  const { q } = await searchParams;
  const t = await getTranslations("additionalDocuments");
  const [rows, cases] = await Promise.all([
    listRequirements(session),
    listCaseOptions(session),
  ]);
  const summary = summariseRequirements(rows);
  const stats: React.ComponentProps<typeof CommandBand>["stats"] = [
    {
      icon: <FileClockIcon className="size-4" />,
      label: t("page.awaitingUpload"),
      value: String(summary.pendingUpload),
      caption:
        summary.overdue > 0
          ? t("page.pastDue", { count: summary.overdue })
          : t("page.noneOverdue"),
      accent: summary.overdue > 0 ? "rose" : undefined,
    },
    {
      icon: <AlertTriangleIcon className="size-4" />,
      label: t("page.underReview"),
      value: String(summary.underReview),
      caption: t("page.awaitingImgc"),
      accent: summary.underReview > 0 ? "amber" : undefined,
    },
    {
      icon: <RotateCcwIcon className="size-4" />,
      label: t("page.reuploadRequired"),
      value: String(summary.reuploadRequired + summary.rejected),
      caption: t("page.rejectedOutright", { count: summary.rejected }),
    },
    {
      icon: <CheckCircle2Icon className="size-4" />,
      label: t("page.approved"),
      value: String(summary.approved),
      caption: t("page.ofRaised", { count: summary.total }),
      accent: "teal",
    },
  ];

  return (
    <PortalShell activeKey="accounts" title={t("page.title")}>
      <div className="space-y-4">
        <CommandBand
          title={t("page.heading")}
          subtitle={t("page.subtitle")}
          stats={stats}
        />

        <AdditionalDocumentsClient
          rows={rows}
          cases={cases}
          initialQuery={q ?? ""}
        />
      </div>
    </PortalShell>
  );
}
