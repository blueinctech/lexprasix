import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Server-only guards and Next request APIs are stubbed for unit/integration tests.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
      "next/cache": path.resolve(import.meta.dirname, "tests/stubs/next-cache.ts"),
      "next/server": path.resolve(import.meta.dirname, "tests/stubs/next-server.ts"),
      "next/headers": path.resolve(import.meta.dirname, "tests/stubs/next-headers.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
