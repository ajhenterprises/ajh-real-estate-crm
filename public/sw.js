// Minimal service worker. Two jobs, deliberately nothing more:
//
// 1. PWA installability — Chrome/Android require an active service worker
//    with a fetch handler before showing the install prompt. This one
//    does pure passthrough (network only, no caching strategy) — the CRM
//    needs a live database connection for everything it does, so an
//    offline cache would only serve stale or broken pages. Per the
//    product's own requirement: a reliable, fast *online* PWA, not
//    complicated offline sync.
// 2. Web Push display — shows the notification a push event carries and
//    routes a tap on it to the right page in the app (see
//    src/lib/notifications for what sends these).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "AJH Real Estate CRM", body: event.data.text() };
  }

  const title = payload.title || "AJH Real Estate CRM";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
