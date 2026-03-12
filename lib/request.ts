export type RequestFn = typeof fetch;

let impl: RequestFn = globalThis.fetch;

export function request(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return impl(input, init);
}

export interface FetchJsonOptions extends RequestInit {
  timeout?: number;
  label?: string;
}

export async function fetchJson<T>(
  input: string | URL,
  opts?: FetchJsonOptions,
): Promise<T | null> {
  const { timeout, label = "HTTP", ...init } = opts ?? {};
  try {
    if (timeout) init.signal = AbortSignal.timeout(timeout);
    const resp = await request(input, init);
    if (!resp.ok) {
      console.error(`${label} HTTP ${resp.status}`);
      return null;
    }
    return (await resp.json()) as T;
  } catch (err) {
    console.error(`${label} fetch error:`, err);
    return null;
  }
}

export function setRequest(fn: RequestFn): () => void {
  const prev = impl;
  impl = fn;
  return () => { impl = prev; };
}
