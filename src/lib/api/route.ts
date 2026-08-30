import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AppError } from '@/lib/api/errors';
import { fail } from '@/lib/api/respond';
import { connectToDatabase } from '@/lib/db';
import {
  isCastError,
  isDuplicateKeyError,
  isMongooseValidationError,
} from '@/lib/mongo-errors';

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
    return fail(400, 'VALIDATION_ERROR', 'Some of those fields need another look.', flattenZodError(error));
  }

  if (error instanceof AppError) {
    return fail(error.status, error.code, error.message, error.details);
  }

  if (isDuplicateKeyError(error)) {
    return fail(409, 'CONFLICT', 'That already exists.');
  }

  if (isCastError(error)) {
    return fail(400, 'VALIDATION_ERROR', 'That link does not point at anything.');
  }

  if (isMongooseValidationError(error)) {
    return fail(400, 'VALIDATION_ERROR', 'Some of those fields need another look.');
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
