"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { useRememberedHref } from "@/lib/hooks/useRememberedFilters";

/**
 * "All accounts" / "Back" — returns to a grid still filtered the way it was left.
 *
 * A client component only so it can read the remembered filter; the markup is the plain link the
 * server component used to render inline.
 */
export function GridBackLink({
  href,
  storageKey,
  label,
  className,
}: Readonly<{
  href: string;
  storageKey: string;
  label: string;
  className?: string;
}>) {
  const backHref = useRememberedHref(href, storageKey);

  return (
    <Link href={backHref} className={className}>
      <ArrowLeftIcon className="size-3.5" /> {label}
    </Link>
  );
}
