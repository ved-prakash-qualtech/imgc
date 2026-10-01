import type { PaginationState, SortingState } from "@tanstack/react-table";

export type DataTableUrlStateConfig = {
  paramPrefix?: string;
  defaultPageSize?: number;
};

export type DataTableUrlState = {
  pagination: PaginationState;
  sorting: SortingState;
};

function paramKey(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}_${name}` : name;
}

export function parseDataTableUrlState(
  searchParams: URLSearchParams,
  config: DataTableUrlStateConfig = {}
): DataTableUrlState {
  const { paramPrefix, defaultPageSize = 10 } = config;

  const pageRaw = searchParams.get(paramKey(paramPrefix, "page"));
  const pageSizeRaw = searchParams.get(paramKey(paramPrefix, "pageSize"));
  const sort = searchParams.get(paramKey(paramPrefix, "sort"));
  const dir = searchParams.get(paramKey(paramPrefix, "dir"));

  const pageIndex = Math.max(
    0,
    (pageRaw ? Number.parseInt(pageRaw, 10) : 1) - 1
  );
  const parsedPageSize = pageSizeRaw
    ? Number.parseInt(pageSizeRaw, 10)
    : defaultPageSize;
  const pageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? parsedPageSize
      : defaultPageSize;

  const sorting: SortingState =
    sort && (dir === "asc" || dir === "desc")
      ? [{ id: sort, desc: dir === "desc" }]
      : [];

  return {
    pagination: { pageIndex, pageSize },
    sorting,
  };
}

export function serializeDataTableUrlState(
  params: URLSearchParams,
  pagination: PaginationState,
  sorting: SortingState,
  config: DataTableUrlStateConfig = {}
): URLSearchParams {
  const { paramPrefix, defaultPageSize = 10 } = config;
  const next = new URLSearchParams(params);

  const pageKey = paramKey(paramPrefix, "page");
  const pageSizeKey = paramKey(paramPrefix, "pageSize");
  const sortKey = paramKey(paramPrefix, "sort");
  const dirKey = paramKey(paramPrefix, "dir");

  if (pagination.pageIndex > 0) {
    next.set(pageKey, String(pagination.pageIndex + 1));
  } else {
    next.delete(pageKey);
  }

  if (pagination.pageSize !== defaultPageSize) {
    next.set(pageSizeKey, String(pagination.pageSize));
  } else {
    next.delete(pageSizeKey);
  }

  const activeSort = sorting[0];
  if (activeSort) {
    next.set(sortKey, activeSort.id);
    next.set(dirKey, activeSort.desc ? "desc" : "asc");
  } else {
    next.delete(sortKey);
    next.delete(dirKey);
  }

  return next;
}
