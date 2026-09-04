# Data table

TanStack Table wrappers in `src/components/dataTable/` (add when implementing tables).

## URL state

Sync sort/filter/pagination with URL via:

- `useDataTableUrlState` (`src/hooks/`)
- `parseDataTableUrlState` / `serializeDataTableUrlState` (`src/lib/utils/dataTable/`)

## Pattern

```tsx
"use client";

import { useDataTableUrlState } from "@/hooks/useDataTableUrlState";

export function MyTable({ data }: { data: MyRow[] }) {
  const { pagination, sorting, onPaginationChange, onSortingChange } =
    useDataTableUrlState();

  // wire into TanStack Table
}
```

Import URL-state helpers from `@/hooks/useDataTableUrlState` and `@/lib/utils/dataTable/` — not from a `dataTable` component barrel.

## Related

- [Core — types and hooks](../core/types-and-hooks.md)
