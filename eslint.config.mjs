import next from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "drizzle/**"] },
  ...next,
  ...typescript,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/auth/**", "src/server/jobs/**", "src/server/email/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["**/db/system"], message: "Only auth, email and jobs may use the system connection." }] },
      ],
    },
  },
];

export default config;
