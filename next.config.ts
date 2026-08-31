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
};

export default nextConfig;
