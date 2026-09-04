"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "unsupported" | "not-configured" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const array = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i);
  return array;
}

/** Enable/disable push notifications for this browser. Gracefully reports unsupported/denied rather than erroring — Safari on macOS and any browser with notifications blocked at the OS level are real, expected states, not bugs. */
export function PushSubscribeButton({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function detectStatus(): Promise<Status> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
        return "unsupported";
      }
      if (!vapidPublicKey) return "not-configured";
      if (Notification.permission === "denied") return "denied";

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription ? "subscribed" : "unsubscribed";
      } catch {
        return "unsubscribed";
      }
    }

    let cancelled = false;
    detectStatus().then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function handleEnable() {
    if (!vapidPublicKey) return;
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setStatus("subscribed");
    } catch {
      setStatus("unsubscribed");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } finally {
      setPending(false);
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return <p className="text-sm text-muted-foreground">Push notifications aren&rsquo;t supported in this browser.</p>;
  }
  if (status === "not-configured") {
    return <p className="text-sm text-muted-foreground">Push notifications aren&rsquo;t configured for this CRM yet.</p>;
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications are blocked for this site. Enable them in your browser&rsquo;s site settings, then reload this page.
      </p>
    );
  }

  if (status === "subscribed") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-status-ontrack">Push notifications are on for this device.</span>
        <button
          type="button"
          onClick={handleDisable}
          disabled={pending}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
        >
          {pending ? "Turning off…" : "Turn off"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Enabling…" : "Enable push notifications on this device"}
    </button>
  );
}
