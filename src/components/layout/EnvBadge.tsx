import { appConfig } from "@/constants/config";

export function EnvBadge() {
  if (appConfig.isProduction) {
    return null;
  }

  return (
    <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {appConfig.appEnv}
    </span>
  );
}
