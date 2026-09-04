/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { NetworkFirstOptions } from "workbox-strategies/NetworkFirst";

declare const self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Lifecycle: take over immediately on new deploy ────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  // Versions before this one stored authenticated API responses in api-cache.
  // Remove those entries on every activation rather than trusting cache expiry.
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name.startsWith("api-cache")).map((name) => caches.delete(name))),
    ).then(() => self.clients.claim()),
  );
});

registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "html-cache",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 }),
      ],
    } as NetworkFirstOptions),
    { denylist: [/^\/api\//] },
  ),
);

// Private objects are authorization-scoped and must never survive in a shared cache.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/storage/objects/"),
  new NetworkOnly(),
);

// API responses may be personalized even where an endpoint appears public.
// Never put /api data in Cache Storage.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly(),
);

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type !== "PURGE_AUTHENTICATED_API_CACHE") return;
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name.startsWith("api-cache")).map((name) => caches.delete(name))),
    ),
  );
});

// ── Static assets — cache-first ───────────────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "image-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// ── Google Fonts ──────────────────────────────────────────────────────────────
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" }),
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    url?: string;
  } = {};
  try { payload = event.data.json(); } catch { payload = { body: event.data.text() }; }

  const title = payload.title ?? "Shepherd Connect";
  const options: NotificationOptions & { vibrate?: number[] } = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/pwa-192.png",
    badge: payload.badge ?? "/pwa-192.png",
    tag: payload.tag,
    data: { url: payload.url ?? "/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl: string = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          (client as WindowClient).navigate(targetUrl);
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
