# Components

Shared UI in `src/components/` — domain-agnostic building blocks.

## Directory layout

```
src/components/
├── providers/          # TenantProvider, other context providers
└── ui/                 # shadcn/ui primitives (button, input, dialog, …)
```

## Providers

| Provider         | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `TenantProvider` | Exposes current tenant to client components via `useTenant()` |

`TenantProvider` is wired in the root layout and receives tenant data resolved server-side. Client components call `useTenant()` — never re-derive from `window.location`.

## UI primitives (`ui/`)

shadcn/ui on Radix + Base UI: `button`, `input`, `form`, `select`, `dialog`, `table`, `badge`, etc.

## Styling

- Tailwind utilities + `cn()` from `@/lib/utils/twMergeUtils`
- miFIN™ design tokens via CSS custom properties
- Per-tenant brand overrides applied in root layout via `tenantTheme.ts`

## Related

- [Forms](./forms.md)
- [Standards — multitenancy](../standards/nextjs-multitenant-template.md)
