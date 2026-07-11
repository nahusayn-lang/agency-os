"use client";

import { useEffect } from "react";

// pushManager.subscribe() requires the VAPID public key as a raw
// Uint8Array<ArrayBuffer>, not a base64 string — passing the string directly
// throws immediately and the subscription is never created. The explicit
// `Uint8Array<ArrayBuffer>` return type (instead of plain Uint8Array) is
// what fixes the "applicationServerKey" TypeScript error you're seeing.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushInit({ userId }: { userId: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      // Push isn't configured for this environment — don't attempt to
      // subscribe (that would throw) and don't spam the console.
      return;
    }

    async function init() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const existing = await reg.pushManager.getSubscription();
        const subscription =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
          }));

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, userId }),
        });

        if (!res.ok) {
          console.error("Failed to save push subscription:", await res.text());
        }
      } catch (err) {
        console.error("Push init failed:", err);
      }
    }

    init();
  }, [userId]);

  return null;
}