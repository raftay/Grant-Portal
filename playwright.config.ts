import { defineConfig } from "@playwright/test";
import { environment } from "./tests/e2e/environment";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure", permissions: ["clipboard-read", "clipboard-write"] },
  webServer: [
    { command: "npx tsx tests/e2e/fake-ai.ts", port: 3999, reuseExistingServer: false },
    { command: "npx tsx tests/e2e/prepare.ts && npx next start -p 3000", url: "http://localhost:3000/login", timeout: 90_000, reuseExistingServer: false, env: environment },
  ],
});
