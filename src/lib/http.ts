'use client';

/**
 * Thin client-side fetch wrapper that understands the API's `{ data }` /
 * `{ error }` envelope, so components handle one error type instead of
 * re-implementing response parsing everywhere.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  /** Per-field messages from server-side zod validation, when present. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type Envelope<T> = {
  data?: T;
  meta?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

function toFieldErrors(details: unknown): Record<string, string[]> {
  if (!details || typeof details !== 'object') return {};
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (Array.isArray(value)) result[key] = value.map(String);
  }
  return result;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    // Send the session cookie on same-origin requests.
    credentials: 'same-origin',
  });

  if (response.status === 204) return undefined as T;

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiRequestError(response.status, 'INTERNAL_ERROR', 'Unexpected server response.', {});
  }

  if (!response.ok || body.error) {
    const error = body.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Request failed.',
      toFieldErrors(error?.details),
    );
  }

  return body.data as T;
}

export function postJson<T>(path: string, payload: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function patchJson<T>(path: string, payload: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
