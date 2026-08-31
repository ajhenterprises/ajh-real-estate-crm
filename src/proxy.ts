import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

// Edge-level authorization boundary: nothing outside the public paths below
// renders without a valid session. Page-level `requireSession()` calls are
// the enforcement of record; this middleware exists so an unauthenticated
// request never even reaches a server component's data-fetching code.
// Uses the edge-safe config (no Credentials provider / Prisma) because
// middleware runs on the Edge runtime.
const { auth } = NextAuth(edgeAuthConfig);

export default auth((req) => {
  const isLoggedIn = Boolean(req.auth?.user);
  const isPublicPath =
    req.nextUrl.pathname === "/login" || req.nextUrl.pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && req.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
