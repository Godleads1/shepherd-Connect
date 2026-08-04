import { useEffect, useRef } from "react";

type SSEHandler = (data: unknown) => void;

/**
 * Subscribe to server-sent events from /api/events.
 *
 * Pass an object of { eventName: handler } — the hook registers each handler
 * on the EventSource and automatically reconnects with exponential back-off if
 * the connection drops (network blip, server restart, etc.).
 *
 * The connection is torn down when the component unmounts.
 */
export function useSSE(
  handlers: Record<string, SSEHandler>,
  enabled = true,
): void {
  // Keep handlers stable — use a ref so the effect doesn't re-run on every render
  const handlersRef = useRef<Record<string, SSEHandler>>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2_000; // start at 2 s
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      es = new EventSource(
        `/api/events?token=${encodeURIComponent(token!)}`,
      );

      es.addEventListener("connected", () => {
        retryDelay = 2_000; // reset back-off on successful connect
      });

      // Dynamically register every handler passed in
      for (const [event] of Object.entries(handlersRef.current)) {
        es.addEventListener(event, (e: MessageEvent) => {
          const handler = handlersRef.current[event];
          if (!handler) return;
          try {
            handler(JSON.parse(e.data));
          } catch {
            handler(e.data);
          }
        });
      }

      es.onerror = () => {
        es?.close();
        es = null;
        if (unmounted) return;
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30_000); // cap at 30 s
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [enabled]); // only re-run if enabled changes
}
