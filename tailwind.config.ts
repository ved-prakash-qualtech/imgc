import type { Config } from "tailwindcss";

/**
 * Tailwind v4: design tokens live in CSS under `src/styles/theme/`
 * (`colors.css`, `typography.css`) and `@theme` in `src/styles/globals.css`.
 * This file mainly controls **content scanning** and optional JS-only options.
 *
 * @see https://tailwindcss.com/docs/detecting-classes-in-source-files
 */
export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/stores/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/constants/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/types/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/styles/**/*.css",
    "./src/stories/**/*.{js,ts,jsx,tsx,mdx}",
    "./.storybook/**/*.{js,ts,jsx,tsx}",
  ],
} satisfies Config;
