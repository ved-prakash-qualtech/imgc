# Forms

React Hook Form + Zod + shared field components.

## Stack

| Tool                      | Role                                      |
| ------------------------- | ----------------------------------------- |
| React Hook Form           | Form state                                |
| `@hookform/resolvers/zod` | Schema resolver                           |
| Zod                       | Validators in `src/features/*/validator/` |
| `src/components/forms/`   | Field wrappers (add as needed)            |

## Pattern

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

export function MyForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  return (
    <form onSubmit={form.handleSubmit((data) => console.log(data))}>
      <input {...form.register("name")} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Prop types

Form field prop types live in `src/types/forms.ts`.

## Related

- [Components](./README.md)
- [Guides — examples](../guides/examples.md)
