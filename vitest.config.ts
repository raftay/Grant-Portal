import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/helpers/empty.ts", import.meta.url)),
     },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/helpers/global-setup.ts"],
    fileParallelism: false,
    server: { deps: { inline: ["next-auth"] } },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
