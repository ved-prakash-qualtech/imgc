import { NextIntlClientProvider } from "next-intl";
import type { Preview } from "@storybook/nextjs-vite";

import { QueryProvider } from "@imgc/ui/providers/QueryProvider";
import { TenantProvider } from "@imgc/ui/shared/TenantProvider";
import enMessages from "@imgc/i18n/translations/en.json";
import "@imgc/ui/styles/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    darkMode: {
      current: "light",
      darkClass: "dark",
      lightClass: "light",
      stylePreview: true,
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#0a0a0a",
        },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="font-sans">
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <QueryProvider>
            <TenantProvider tenant="qc">
              <Story />
            </TenantProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </div>
    ),
  ],
};

export default preview;
