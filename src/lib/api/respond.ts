import { NextResponse } from 'next/server';

import type { ErrorCode } from '@/lib/api/errors';

/** Every successful response is `{ data, meta? }`; every failure is `{ error }`. */
export type ApiSuccess<T> = { data: T; meta?: PaginationMeta };
export type ApiFailure = {
  error: { code: ErrorCode; message: string; details?: unknown };
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function ok<T>(data: T, meta?: PaginationMeta): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(meta ? { data, meta } : { data }, { status: 200 });
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { error: details === undefined ? { code, message } : { code, message, details } },
    { status },
  );
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
