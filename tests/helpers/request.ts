import { NextRequest } from 'next/server';

const BASE_URL = 'http://localhost:3000';

type RequestInitOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
};

/**
 * Builds a real NextRequest so handlers exercise their actual cookie parsing,
 * body reading and query handling rather than a mock.
 */
export function jsonRequest(path: string, options: RequestInitOptions = {}): NextRequest {
  const { method = 'GET', body, cookie, headers = {} } = options;

  const requestHeaders = new Headers(headers);
  if (body !== undefined) requestHeaders.set('content-type', 'application/json');
  if (cookie) requestHeaders.set('cookie', cookie);

  return new NextRequest(new URL(path, BASE_URL), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Multipart request used by the resume upload endpoint. */
export function formRequest(
  path: string,
  form: FormData,
  options: { method?: 'POST' | 'PUT' | 'PATCH'; cookie?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (options.cookie) headers.set('cookie', options.cookie);

  return new NextRequest(new URL(path, BASE_URL), {
    method: options.method ?? 'POST',
    headers,
    body: form,
  });
}

/** The App Router passes dynamic params as a promise. */
export function routeContext<P extends Record<string, string>>(params: P): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export type ApiError = { error: { code: string; message: string; details?: unknown } };
export type ApiData<T> = {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
};
