import { useEffect, useRef } from "react";

type SSEHandler = (data: unknown) => void;
type EventSourceConstructor = new (url: string) => EventSource;

/**
 * Minting happens before constructing EventSource so its URL is never a bearer
 * channel. The small dependency-injected surface also makes this ordering
 * directly testable without a browser.
 */
export async function mintSseConnection(
  token: string,
  dependencies: {
    fetchImpl?: typeof fetch;
    EventSourceImpl?: EventSourceConstructor;
  } = {},
): Promise<EventSource> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const EventSourceImpl = dependencies.EventSourceImpl ?? EventSource;
  const response = await fetchImpl("/api/events/ticket", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error("Unable to mint SSE ticket");
  return new EventSourceImpl("/api/events");
}

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

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2_000; // start at 2 s
    let unmounted = false;

    async function connect() {
      if (unmounted) return;

      // Tickets are minted through the authenticated REST client; EventSource
      // itself always connects to a token-free URL and sends only its HttpOnly
      // path-scoped cookie.
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        es = await mintSseConnection(token);
      } catch {
        if (!unmounted) {
          retryTimeout = setTimeout(() => { void connect(); }, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30_000);
        }
        return;
      }
      if (unmounted) return;

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
          void connect();
        }, retryDelay);
      };
    }

    void connect();

    return () => {
      unmounted = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [enabled]); // only re-run if enabled changes
}
