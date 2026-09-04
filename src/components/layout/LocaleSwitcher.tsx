"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { routing, type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();

  const makeLocaleHandler = useCallback(
    (nextLocale: AppLocale) => () => {
      if (nextLocale !== locale) {
        router.replace(pathname, { locale: nextLocale });
      }
    },
    [locale, pathname, router]
  );

  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">{t("language")}</span>
      {routing.locales.map((loc) => (
        <Button
          key={loc}
          type="button"
          variant={locale === loc ? "default" : "ghost"}
          size="sm"
          onClick={makeLocaleHandler(loc)}
          aria-pressed={locale === loc}
        >
          {loc === "en" ? t("english") : t("hindi")}
        </Button>
      ))}
    </div>
  );
}
