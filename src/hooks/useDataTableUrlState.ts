"use client";

import type {
  OnChangeFn,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  parseDataTableUrlState,
  serializeDataTableUrlState,
  type DataTableUrlStateConfig,
} from "@/lib/utils/dataTable/dataTableUrlState";

/**
 * Syncs table pagination/sorting with URL search params for shareable Next.js routes.
 *
 * Server-side tables: read the same params in the page `searchParams`, fetch `{ rows, total }`,
 * then pass `mode="server"` with `data={rows}`, `rowCount={total}`, and `pageCount`.
 */
export function useDataTableUrlState(config: DataTableUrlStateConfig = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { paramPrefix, defaultPageSize = 10 } = config;
  const parseConfig = useMemo(
    () => ({ paramPrefix, defaultPageSize }),
    [paramPrefix, defaultPageSize]
  );

  const { pagination, sorting } = useMemo(
    () => parseDataTableUrlState(searchParams, parseConfig),
    [searchParams, parseConfig]
  );

  const syncUrl = useCallback(
    (nextPagination: PaginationState, nextSorting: SortingState) => {
      const next = serializeDataTableUrlState(
        searchParams,
        nextPagination,
        nextSorting,
        parseConfig
      );
      const query = next.toString();
      const currentQuery = searchParams.toString();
      if (query === currentQuery) {
        return;
      }
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams, parseConfig]
  );

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const nextPagination =
        typeof updater === "function" ? updater(pagination) : updater;
      syncUrl(nextPagination, sorting);
    },
    [pagination, sorting, syncUrl]
  );

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      syncUrl(pagination, nextSorting);
    },
    [pagination, sorting, syncUrl]
  );

  return {
    pagination,
    sorting,
    onPaginationChange,
    onSortingChange,
  };
}
