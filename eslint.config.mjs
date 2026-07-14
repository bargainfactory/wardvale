import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// ESLint 9 flat config bridging Next's shareable configs via FlatCompat.
// Previously the repo had no ESLint config at all, so `next lint` only prompted
// an interactive setup and never actually ran (roadmap G1 lint gap).
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "evals/**", // zero-dep JS harness (live behavioral eval)
      "scripts/**", // one-off JS maintenance scripts
      "*.config.*",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
