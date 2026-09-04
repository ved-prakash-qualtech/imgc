import type { AppEnv } from "@/types/env";

declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_APP_ENV?: AppEnv;
    NEXT_PUBLIC_API_BASE_URL?: string;
    NEXT_PUBLIC_API_TIMEOUT_MS?: string;
    NEXT_PUBLIC_JWT_AUTH_ENABLED?: string;
    NEXT_PUBLIC_APP_VERSION?: string;
    /** Build-time: browser/server/Turbopack source maps (`true` | `false` | `1` | `0`) */
    NEXT_SOURCE_MAPS_ENABLED?: string;
  }
}
