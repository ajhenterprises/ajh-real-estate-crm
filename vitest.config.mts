import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // DB-backed *.integration.test.ts files (see src/test/db.ts) all share
    // one physical test database and truncate its tables in `beforeEach` —
    // running test files in parallel let two files' truncates race and
    // deadlock (or silently wipe rows a concurrently-running file's test
    // had just created). Pure unit tests pay a small, one-time sequential
    // cost for this; the suite is still well under a second.
    fileParallelism: false,
  },
});
