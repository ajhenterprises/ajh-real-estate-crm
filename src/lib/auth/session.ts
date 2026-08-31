import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Every server component and route handler under the authenticated app
 * shell must call this instead of `auth()` directly, so there is exactly
 * one place that decides what "not logged in" means for a page.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
