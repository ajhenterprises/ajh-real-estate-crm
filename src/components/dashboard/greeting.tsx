"use client";

import { useSyncExternalStore } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const noopSubscribe = () => () => {};

/**
 * The greeting depends on the viewer's own clock/time zone, which the
 * server has no way to know — useSyncExternalStore (not useState +
 * useEffect) is the correct primitive for a value like this: it renders
 * `serverGreeting` for the SSR/first-hydration snapshot (see page.tsx,
 * computed from the server's clock) and swaps in the real client-side
 * value right after, with no manual setState-in-effect.
 */
export function Greeting({ serverGreeting, firstName }: { serverGreeting: string; firstName: string }) {
  const greeting = useSyncExternalStore(
    noopSubscribe,
    () => greetingForHour(new Date().getHours()),
    () => serverGreeting,
  );

  return (
    <>
      {greeting}, {firstName}
    </>
  );
}
