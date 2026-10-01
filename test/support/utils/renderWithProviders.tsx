import { NextIntlClientProvider } from "next-intl";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

import { QueryProvider } from "@imgc/ui/providers/QueryProvider";
import enMessages from "@imgc/i18n/translations/en.json";

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <QueryProvider>{children}</QueryProvider>
      </NextIntlClientProvider>
    ),
    ...options,
  });
}
