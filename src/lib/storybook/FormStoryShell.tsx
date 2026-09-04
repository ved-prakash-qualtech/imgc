"use client";

import { useEffect, type ReactNode } from "react";
import {
  useForm,
  type Control,
  type DefaultValues,
  type FieldValues,
  type Path,
} from "react-hook-form";

import { Form } from "@/components/ui/form";

type FormStoryShellProps<T extends FieldValues> = Readonly<{
  defaultValues: DefaultValues<T>;
  errors?: Partial<Record<Path<T>, string>>;
  children: (control: Control<T>) => ReactNode;
  className?: string;
}>;

export function FormStoryShell<T extends FieldValues>({
  defaultValues,
  errors,
  children,
  className = "max-w-md p-4",
}: FormStoryShellProps<T>) {
  const form = useForm<T>({ defaultValues });

  useEffect(() => {
    if (!errors) return;
    for (const [name, message] of Object.entries(errors) as [
      Path<T>,
      string,
    ][]) {
      form.setError(name, { type: "manual", message });
    }
  }, [errors, form]);

  return (
    <Form {...form}>
      <div className={className}>{children(form.control)}</div>
    </Form>
  );
}
