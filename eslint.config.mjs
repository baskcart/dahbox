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
    "next-env.d.ts",
    // Root-level debug/test scripts — plain Node.js CommonJS, not part of the Next.js app
    "check-env.js",
    "test-fixtures.js",
    "test_dynamo.mjs",
  ]),
]);

export default eslintConfig;
