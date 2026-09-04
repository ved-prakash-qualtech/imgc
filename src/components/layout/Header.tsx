import { Link } from "@/i18n/navigation";

import { EnvBadge } from "@/components/layout/EnvBadge";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { ROUTES } from "@/constants/routes";

export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-body">
        <Link href={ROUTES.home} className="font-medium text-foreground">
          Home
        </Link>
        <Link href={ROUTES.examples} className="text-muted-foreground">
          Examples
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher />
          <EnvBadge />
        </div>
      </nav>
    </header>
  );
}
