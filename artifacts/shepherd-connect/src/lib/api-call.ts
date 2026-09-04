const BASE = "/api";
const activeRequests = new Set<AbortController>();

/**
 * Cancels requests made through this helper.  Auth changes call this before
 * replacing credentials so a late response cannot repopulate a prior role's UI.
 */
export function abortUserScopedRequests(): void {
  for (const controller of activeRequests) controller.abort();
  activeRequests.clear();
}

/** Delete API entries left behind by pre-NetworkOnly service workers. */
export async function purgeAuthenticatedApiCache(): Promise<void> {
  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("api-cache")).map((name) => caches.delete(name)));
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "PURGE_AUTHENTICATED_API_CACHE" });
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "PUT",
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "PATCH",
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await request(`${BASE}${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await request(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(res.statusText);
  return res.blob();
}

async function request(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  activeRequests.add(controller);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    activeRequests.delete(controller);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
