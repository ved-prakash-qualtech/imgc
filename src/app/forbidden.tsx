import Link from "next/link";

import { ROUTES } from "@/constants/route";

/**
 * What a caller sees when they open a screen they were not granted.
 *
 * <p>Rendered by Next when {@code DashboardShell} calls {@code forbidden()} — which it does when
 * the page's nav key is absent from the menus this caller may reach.
 *
 * <p>It says the screen exists and is not theirs, rather than pretending it is missing. A 404 for
 * something a colleague can plainly see sends people to look for a broken link, and the honest
 * answer costs nothing here: the sidebar has already told them what they do have.
 *
 * <p>No detail about the screen itself, and no list of who can reach it. Enough to know the
 * request was understood and refused, and who to ask.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#FFFFFF_-6.3%,#FFF3E9_42.72%,#FAD9BC_96.7%)] px-6">
      <div className="w-full max-w-md rounded-2xl bg-white/80 p-8 text-center shadow-sm">
        <p className="text-sm font-medium tracking-wide text-slate-500">403</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          You do not have access to this screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          It exists, and your role has not been granted it. An administrator can
          add it to your role&apos;s permissions.
        </p>
        <Link
          href={ROUTES.dashboard}
          className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
