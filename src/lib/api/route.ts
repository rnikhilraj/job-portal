import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AppError } from '@/lib/api/errors';
import { fail } from '@/lib/api/respond';
import { connectToDatabase } from '@/lib/db';

/**
 * In the App Router, dynamic segment params arrive as a promise.
 * Handlers receive the already-awaited object instead.
 */
type RouteParams = Record<string, string | string[] | undefined>;
type RouteContext<P extends RouteParams> = { params: Promise<P> };

type Handler<P extends RouteParams> = (
  request: NextRequest,
  params: P,
) => Promise<NextResponse> | NextResponse;

type WithRouteOptions = {
  /** Set to false for endpoints that must respond without touching Mongo. */
  connectDb?: boolean;
};

/** Shape of the duplicate-key error Mongo raises against a unique index. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function isCastError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === 'CastError'
  );
}

function isMongooseValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ValidationError';
}

function flattenZodError(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/**
 * Wraps a route handler with the behaviour every endpoint needs: a database
 * connection, one try/catch, and a single place where an exception becomes an
 * HTTP status. Internal failures are logged server-side and returned as a
 * generic 500 so stack traces and driver messages never reach the client.
 */
export function withRoute<P extends RouteParams = RouteParams>(
  handler: Handler<P>,
  options: WithRouteOptions = {},
) {
  const { connectDb = true } = options;

  return async function routeHandler(
    request: NextRequest,
    context: RouteContext<P>,
  ): Promise<NextResponse> {
    try {
      if (connectDb) {
        await connectToDatabase();
      }
      const params = ((await context?.params) ?? {}) as P;
      return await handler(request, params);
    } catch (error) {
      return toErrorResponse(error, request);
    }
  };
}

export function toErrorResponse(error: unknown, request?: NextRequest): NextResponse {
  if (error instanceof ZodError) {
    return fail(400, 'VALIDATION_ERROR', 'Request validation failed.', flattenZodError(error));
  }

  if (error instanceof AppError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  if (isDuplicateKeyError(error)) {
    return fail(409, 'CONFLICT', 'That record already exists.');
  }

  if (isCastError(error)) {
    return fail(400, 'VALIDATION_ERROR', 'Malformed identifier in request.');
  }

  if (isMongooseValidationError(error)) {
    return fail(400, 'VALIDATION_ERROR', 'Request validation failed.');
  }

  console.error(
    `[api] Unhandled error on ${request?.method ?? 'UNKNOWN'} ${request?.nextUrl?.pathname ?? ''}`,
    error,
  );
  return fail(
    500,
    'INTERNAL_ERROR',
    'Something broke on our side. Nothing you did — try again in a moment.',
  );
}
