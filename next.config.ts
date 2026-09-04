import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` and Prisma's driver adapter ship native/CJS internals that the
  // Next.js bundler shouldn't try to trace into.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  experimental: {
    serverActions: {
      // Default is 1mb, too small for a scanned contract PDF. Document
      // uploads go through a Server Action (like every other form in this
      // app) rather than a separate Route Handler, so this is the one
      // place the raw-upload size ceiling is enforced at the framework
      // level; src/lib/documents/validation.ts enforces the same ceiling
      // at the application level with a clearer error message.
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    return [
      {
        // Service workers must be re-checked on every load (the spec
        // requires this regardless of headers, but an aggressively cached
        // response can still delay browsers noticing a new one is
        // available) — explicit no-cache keeps PWA updates rolling out
        // promptly instead of agents getting stuck on a stale version.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
