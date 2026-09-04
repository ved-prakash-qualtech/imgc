/** @type {import('stylelint').Config} */
const config = {
  extends: [
    "stylelint-config-standard",
    "@dreamsicle.io/stylelint-config-tailwindcss",
  ],
  ignoreFiles: [".next/**", "node_modules/**", "out/**", "build/**"],
  rules: {
    /* Tailwind v4 @theme uses names like --text-heading--line-height */
    "custom-property-pattern": null,
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "config",
          "reference",
          "source",
          "plugin",
          "custom-variant",
        ],
      },
    ],
    /* Tailwind v4: @config may appear before additional @import layers */
    "no-invalid-position-at-import-rule": null,
    /* Tailwind entry files chain @import / @config / @theme without blank lines */
    "at-rule-empty-line-before": null,
  },
};

export default config;
