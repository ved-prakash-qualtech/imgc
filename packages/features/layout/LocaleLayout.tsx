import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { WidgetErrorBoundary } from "@imgc/ui/shared/WidgetErrorBoundary";
import { QueryProvider } from "@imgc/ui/providers/QueryProvider";
import { ToasterMount } from "@imgc/features/layout/ToasterMount";
import { ZoneNavigationGuard } from "@imgc/features/layout/ZoneNavigationGuard";
import { APP_NAME, appConfig } from "@imgc/constants/config";
import { routing } from "@imgc/i18n/routing";
import { getTenantOrNull } from "@imgc/lib/tenant";
import { getTenantTheme, themeStyle } from "@imgc/data/server/tenantTheme";
import "@imgc/ui/styles/globals.css";

/**
 * The root layout every zone mounts. It lives here, once, so the zones can never drift apart on
 * fonts, theme, providers or the error boundary — each app's `app/[locale]/layout.tsx` is a
 * re-export of this file.
 */
const outfit = localFont({
  src: "./fonts/outfit-latin-var.woff2",
  variable: "--font-outfit",
  weight: "400 700",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  variable: "--font-inter",
  weight: "400 700",
  display: "swap",
});

type Props = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return {
    title: {
      default: APP_NAME,
      template: `%s · ${APP_NAME}`,
    },
    description: appConfig.isProduction
      ? "IMGC Lender Portal"
      : `${APP_NAME} · ${appConfig.appEnv} · v${appConfig.version}`,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  // Per-tenant branding: four CSS custom properties on <html>, nothing else. Components keep
  // using the token names and never learn which tenant they are rendering for.
  const theme = await getTenantTheme(await getTenantOrNull());

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
      style={theme ? themeStyle(theme) : undefined}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <WidgetErrorBoundary variant="app">{children}</WidgetErrorBoundary>
            <ToasterMount />
            <ZoneNavigationGuard />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
