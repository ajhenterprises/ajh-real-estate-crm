"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on mount. A no-op (not an error) wherever service
 * workers aren't supported — e.g. some in-app browsers — so this never
 * blocks the rest of the app from working.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability/push just won't be available this session — the
      // CRM itself doesn't depend on the service worker to function.
    });
  }, []);

  return null;
}
