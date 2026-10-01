"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@imgc/ui/ui/button";
import { cn } from "@imgc/lib/utils/twMergeUtils";

/** Reloads the current server-rendered data in place — no route change, no client cache to bust. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router]
  );

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
      disabled={pending}
      onClick={refresh}
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} /> Refresh
    </Button>
  );
}
