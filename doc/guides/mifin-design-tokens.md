# miFIN™ Design Tokens — Implementation

How the **miFIN™ Design System** tokens are wired into this template.

> Rule #1: design tokens are the **only** source of color, radius, shadow and
> spacing. Never hardcode hex/px in component code — use the tokens/utilities below.

---

## 1. Where the tokens live

| File                  | Holds                               |
| --------------------- | ----------------------------------- |
| `src/app/globals.css` | Tailwind `@theme` keys, base styles |

---

## 2. Per-tenant brand overrides

Per-tenant theming = **BRAND-token overrides only**:

- Implementation: `src/lib/tenantTheme.ts`
- Applied in root layout as CSS custom properties on `<html>`
- Components use miFIN™ token names — **NEVER** branch on tenant identity

```typescript
// tenantTheme.ts resolves CSS vars per tenant
// e.g., --brand-primary: #7c3aed for purple-branded tenants
```

Components keep using:

```tsx
<button className="bg-brand-primary text-white">
```

The CSS variable value changes per tenant, but the class name stays the same.

---

## 3. What is tenant-overridable

| Token category                           | Tenant-overridable? |
| ---------------------------------------- | ------------------- |
| Brand colors (`--brand-*`)               | ✅ Yes              |
| Neutrals (`--neutral-*`)                 | ❌ No               |
| Semantic colors (success/warning/danger) | ❌ No               |
| Spacing / radius                         | ❌ No               |
| Typography scale                         | ❌ No               |

Only brand tokens can be overridden. Structural tokens are fixed across all tenants.

---

## 4. Color utilities

Tailwind utilities generated from the `@theme` block:

- Brand: `bg-brand-primary`, `text-brand-dark`, `bg-brand-muted`, `bg-brand-light`
- Neutral ramp: `bg-neutral-25` … `text-neutral-950`
- Semantic (state only): `text-success-500`, `bg-warning-600`, `bg-danger-600`, `text-info-700`
- Radius: `rounded-sm` (4) `rounded-md` (6) `rounded-lg` (8) `rounded-xl` (12)
- Elevation: `shadow-sm` … `shadow-xl`

---

_Template-local companion to the Qualtech Engineering Framework miFIN™ Design System spec._
