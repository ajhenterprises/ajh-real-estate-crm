import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config: session strategy, pages, and JWT/session shaping
 * only — no providers. Middleware runs on the Edge runtime and must not
 * pull in the Credentials provider, which imports Prisma/pg (Node-only).
 * The full config in `config.ts` extends this with providers for use in
 * the API route handler and server components/actions.
 */
export const edgeAuthConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
