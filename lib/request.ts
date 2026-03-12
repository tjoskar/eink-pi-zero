export type RequestFn = typeof fetch;

let impl: RequestFn = globalThis.fetch;

export function request(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return impl(input, init);
}

export function setRequest(fn: RequestFn): () => void {
  const prev = impl;
  impl = fn;
  return () => { impl = prev; };
}
