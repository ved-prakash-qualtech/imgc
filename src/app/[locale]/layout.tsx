import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToasterMount } from "@/components/layout/ToasterMount";
import { APP_NAME, appConfig } from "@/constants/config";
import { routing } from "@/i18n/routing";
import "@/app/globals.css";

const outfit = localFont({
  src: "../fonts/outfit-latin-var.woff2",
  variable: "--font-outfit",
  weight: "400 700",
  display: "swap",
});

const inter = localFont({
  src: "../fonts/inter-latin-var.woff2",
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
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <WidgetErrorBoundary variant="app">{children}</WidgetErrorBoundary>
            <ToasterMount />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
