import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` and Prisma's driver adapter ship native/CJS internals that the
  // Next.js bundler shouldn't try to trace into.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
};

export default nextConfig;
