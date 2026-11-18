import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "android/app/build/**",
    "android/app/src/main/assets/**",
    "android/.gradle/**",
    "next-env.d.ts",
    // Agent git worktrees (each a full checkout with its own build output).
    ".claude/**",
  ]),
]);

export default eslintConfig;
