// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import useClientPlugin from "@naverpay/eslint-plugin-use-client";
import eslintConfigPrettier from "eslint-config-prettier";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintPluginJsxA11y from "eslint-plugin-jsx-a11y";
import eslintPluginReactPerf from "eslint-plugin-react-perf";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";
import eslintPluginSecurity from "eslint-plugin-security";

/** An app's own code: routes and per-app wiring. */
const appFiles = [
  "apps/*/src/**/*.{js,jsx,ts,tsx}",
  "src/**/*.{js,jsx,ts,tsx}",
];
/**
 * Everything the portal is made of — the apps and the shared packages. The packages inherited the
 * rules when their code moved out of `src/`, so none of them are weaker than they were.
 */
const srcTsx = [
  ...appFiles,
  "packages/**/*.{js,jsx,ts,tsx}",
  "storybook/**/*.{js,jsx,ts,tsx}",
];

const eslintConfig = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    ".pnpm/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/next-env.d.ts",
    "test/playwright-report/**",
    "test/test-results/**",
    "test/blob-report/**",
    "storybook-static/**",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    files: srcTsx,
    rules: {
      ...eslintPluginJsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    files: appFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*"],
              message:
                "Use the @/ path alias (paths under the app's src/) or an @imgc/* package import instead of parent-relative imports.",
            },
            {
              group: ["./*", "./**"],
              message:
                "Use the @/ path alias (paths under the app's src/) or an @imgc/* package import instead of same-folder ./ imports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: srcTsx,
    ...eslintPluginReactPerf.configs.flat.recommended,
    rules: {
      ...eslintPluginReactPerf.configs.flat.recommended.rules,
      "react-perf/jsx-no-new-object-as-prop": [
        "warn",
        { nativeAllowList: "all" },
      ],
      "react-perf/jsx-no-new-array-as-prop": "warn",
      "react-perf/jsx-no-new-function-as-prop": "warn",
      "react-perf/jsx-no-jsx-as-prop": "warn",
    },
  },
  {
    files: srcTsx,
    ...reactYouMightNotNeedAnEffect.configs.recommended,
  },
  {
    files: srcTsx,
    plugins: {
      "use-client": useClientPlugin,
    },
    rules: {
      "use-client/browser-api": [
        "warn",
        {
          ignorePath: ["packages/lib/storage/**"],
        },
      ],
    },
  },
  {
    // next.config.ts loads env.ts without @/ alias resolution — relative imports required.
    files: [
      "packages/constants/env/env.ts",
      "packages/constants/env/envSchema.ts",
      "packages/constants/envDefaults.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Vendored shadcn/ui components use radix-ui render-prop patterns and
    // imperative DOM APIs that legitimately require inline JSX props and effects.
    files: ["packages/ui/ui/**/*.{ts,tsx}"],
    rules: {
      "react-perf/jsx-no-jsx-as-prop": "off",
      "react-perf/jsx-no-new-object-as-prop": "off",
      "react-perf/jsx-no-new-function-as-prop": "off",
      "react-you-might-not-need-an-effect/no-event-handler": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/click-events-have-key-events": "off",
    },
  },
  {
    // Storybook shell intentionally uses useEffect to imperatively set form
    // errors from story props — this pattern is unavoidable in Storybook context.
    // DataTableVirtualizedBody uses inline row style that includes runtime values
    // (virtualRow.size, virtualRow.start) and cannot be hoisted to a constant.
    files: [
      "storybook/stories/support/**/*.{ts,tsx}",
      "packages/ui/dataTable/DataTableVirtualizedBody.tsx",
    ],
    rules: {
      "react-you-might-not-need-an-effect/no-event-handler": "off",
      "react-perf/jsx-no-new-object-as-prop": "off",
    },
  },
  eslintPluginSecurity.configs.recommended,
  {
    // Vendored from identity-portal-web-app, file for file, so that the two products cannot drift
    // apart screen by screen — a re-copy has to drop in unchanged. Editing them here to satisfy a
    // lint rule would defeat that: the next copy would silently revert it, and the diff against
    // the portal would stop being empty, which is the only signal that the copy is still true.
    //
    // Fix these upstream in the portal and re-copy. Everything else stays on: this turns off the
    // rules the copies actually trip, not the plugins.
    files: [
      "packages/features/identity-control/**/*.{ts,tsx}",
      "packages/lib/identity-control/**/*.{ts,tsx}",
      "packages/types/identity-control/**/*.{ts,tsx}",
      "packages/data/services/identity-control/**/*.{ts,tsx}",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "jsx-a11y/no-autofocus": "off",
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "react-perf/jsx-no-jsx-as-prop": "off",
      "react-perf/jsx-no-new-object-as-prop": "off",
      "react-perf/jsx-no-new-array-as-prop": "off",
      "react-perf/jsx-no-new-function-as-prop": "off",
      "react-you-might-not-need-an-effect/no-derived-state": "off",
      "react-you-might-not-need-an-effect/no-chain-state-updates": "off",
      "react-you-might-not-need-an-effect/no-initialize-state": "off",
      "react-you-might-not-need-an-effect/no-event-handler": "off",
      "security/detect-object-injection": "off",
      "use-client/browser-api": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // The UI is token-driven: a component names a token, never a colour. A raw hex here is a
    // colour that no tenant theme, dark mode or rebrand can ever reach — the whole point of the
    // token layer. Add the value to packages/ui/styles/theme/colors.css and use the token instead.
    files: [...appFiles, "packages/**/*.{ts,tsx}"],
    ignores: [
      // The one place a colour is a value rather than a style: the tenant's own brand, and the
      // fallback used when a tenant has none.
      "packages/data/server/tenantTheme.ts",
      "packages/data/server/standInRegistry.ts",
      "packages/features/identity-control/**",
      "packages/lib/identity-control/**",
      "storybook/**",
      "test/support/**",
      "packages/data/server/mock/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Hard-coded colour. Use a design token (e.g. text-brand-primary, var(--chart-2)) — add the value to packages/ui/styles/theme/colors.css if it does not exist yet.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Hard-coded colour. Use a design token — add the value to packages/ui/styles/theme/colors.css if it does not exist yet.",
        },
      ],
    },
  },
  eslintConfigPrettier,
  ...storybook.configs["flat/recommended"],
]);

export default eslintConfig;
