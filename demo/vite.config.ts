import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const replaced = new Map(
  Object.entries({
    "../src/db/client.ts": "./shims/client.ts",
    "../src/db/with-user.ts": "./shims/with-user.ts",
    "../src/db/system.ts": "./shims/system.ts",
    "../src/lib/send-file.ts": "./shims/send-file.ts",
    "../src/components/file-links.tsx": "./shims/file-links.tsx",
    "../src/components/file-preview.tsx": "./shims/file-preview.tsx",
    "../src/app/actions/auth.ts": "./shims/actions-auth.ts",
    "../src/app/actions/records.ts": "./shims/actions-records.ts",
    "../src/app/actions/files.ts": "./shims/actions-files.ts",
    "../src/server/storage/storage.ts": "./shims/storage.ts",
    "../src/server/ai/extract.ts": "./shims/extract.ts",
    "../src/server/env.ts": "./shims/env.ts",
    "../src/server/auth/config.ts": "./shims/auth-config.ts",
    "../src/server/auth/password.ts": "./shims/password.ts",
  }).map(([real, shim]) => [here(real), here(shim)]),
);

const swapModules: Plugin = {
  name: "demo-swap-modules",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || importer.includes("/node_modules/") || importer.includes("/demo/shims/actions-")) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    const shim = resolved && replaced.get(resolved.id);
    return shim ? shim : resolved;
  },
};

export default defineConfig({
  root: here("."),
  base: "/Grant-Portal/",
  plugins: [swapModules],
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: here("./shims/empty.ts") },
      { find: /^node:crypto$/, replacement: here("./shims/crypto.ts") },
      { find: /^next\/link$/, replacement: here("./shims/link.tsx") },
      { find: /^next\/navigation$/, replacement: here("./shims/navigation.ts") },
      { find: /^next\/cache$/, replacement: here("./shims/cache.ts") },
      { find: /^next-auth$/, replacement: here("./shims/next-auth.ts") },
      { find: /^@\//, replacement: `${here("../src")}/` },
    ],
  },
  css: { postcss: here("..") },
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  build: { outDir: here("./dist"), emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 },
  preview: { port: 3100, strictPort: true },
});
