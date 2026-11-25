import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/demo",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 25_000 },
  reporter: "list",
  use: { baseURL: "http://localhost:3100/Grant-Portal/", trace: "retain-on-failure" },
  webServer: { command: "npm run demo:preview", url: "http://localhost:3100/Grant-Portal/", reuseExistingServer: false },
});
