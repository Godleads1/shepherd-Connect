import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api-call";

type PushState = "unsupported" | "loading" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!isSupported) { setState("unsupported"); return; }

    (async () => {
      if (Notification.permission === "denied") { setState("denied"); return; }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSubscription(existing);
        setState("subscribed");
      } else {
        setState("unsubscribed");
      }
    })();
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    try {
      setState("loading");

      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState("denied"); return false; }

      const { publicKey } = await apiGet<{ publicKey: string }>("/push/vapid-public-key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await apiPost("/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
      setSubscription(sub);
      setState("subscribed");
      return true;
    } catch {
      setState("unsubscribed");
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;
    try {
      setState("loading");
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await apiDelete("/push/unsubscribe", { endpoint });
      setSubscription(null);
      setState("unsubscribed");
      return true;
    } catch {
      setState("subscribed");
      return false;
    }
  }, [subscription]);

  return { state, subscribe, unsubscribe, isSupported };
}
