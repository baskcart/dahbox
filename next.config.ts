import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly inline server-side env vars into the bundle at build time.
  // Required for Amplify Gen 1 WEB_COMPUTE: the Lambda runtime does not
  // receive custom Amplify console env vars in process.env at runtime.
  // Values come from the Amplify build shell (set in Amplify console) — never hardcoded here.
  env: {
    CUSTOM_AWS_ACCESS_KEY_ID:     process.env.CUSTOM_AWS_ACCESS_KEY_ID     ?? "",
    CUSTOM_AWS_SECRET_ACCESS_KEY: process.env.CUSTOM_AWS_SECRET_ACCESS_KEY ?? "",
    DAHBOX_STAKES_TABLE:          process.env.DAHBOX_STAKES_TABLE          ?? "DAHBOX_STAKES",
    ROLLEDGE_API_URL:             process.env.ROLLEDGE_API_URL             ?? "https://w3ledger.com",
  },
};

export default nextConfig;
