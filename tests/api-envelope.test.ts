import { ZodError, z } from 'zod';

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/lib/api/errors';
import { buildPaginationMeta } from '@/lib/api/respond';
import { toErrorResponse } from '@/lib/api/route';

async function readBody(response: Response) {
  return (await response.json()) as {
    error: { code: string; message: string; details?: unknown };
  };
}

describe('API error envelope', () => {
  const cases = [
    { name: 'BadRequestError', error: () => new BadRequestError('bad'), status: 400, code: 'VALIDATION_ERROR' },
    { name: 'UnauthorizedError', error: () => new UnauthorizedError(), status: 401, code: 'UNAUTHORIZED' },
    { name: 'ForbiddenError', error: () => new ForbiddenError(), status: 403, code: 'FORBIDDEN' },
    { name: 'NotFoundError', error: () => new NotFoundError(), status: 404, code: 'NOT_FOUND' },
    { name: 'ConflictError', error: () => new ConflictError(), status: 409, code: 'CONFLICT' },
  ];

  it.each(cases)('maps $name to $status/$code', async ({ error, status, code }) => {
    const response = toErrorResponse(error());
    expect(response.status).toBe(status);
    expect((await readBody(response)).error.code).toBe(code);
  });

  it('turns a ZodError into a 400 with per-field details', async () => {
    const schema = z.object({ email: z.string().email(), age: z.number().min(18) });
    const result = schema.safeParse({ email: 'nope', age: 12 });

    const response = toErrorResponse(result.success ? null : (result.error as ZodError));

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual({
      email: [expect.any(String)],
      age: [expect.any(String)],
    });
  });

  it('maps a Mongo duplicate-key error to 409', async () => {
    const response = toErrorResponse(Object.assign(new Error('E11000'), { code: 11000 }));
    expect(response.status).toBe(409);
    expect((await readBody(response)).error.code).toBe('CONFLICT');
  });

  /*
   * Mongoose reports both of these by `name` rather than by an exported error
   * class, so these two cases are what stops a rename in the driver from
   * silently demoting a handled 400 to a logged 500.
   */
  it('maps a CastError to 400 rather than letting it reach the 500 branch', async () => {
    const response = toErrorResponse(Object.assign(new Error('bad id'), { name: 'CastError' }));

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('That link does not point at anything.');
  });

  it('maps a Mongoose ValidationError to 400', async () => {
    const response = toErrorResponse(
      Object.assign(new Error('validation failed'), { name: 'ValidationError' }),
    );

    expect(response.status).toBe(400);
    const body = await readBody(response);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Some of those fields need another look.');
  });

  it('never leaks internal failure details to the client', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = toErrorResponse(new Error('connection string password=hunter2'));

    expect(response.status).toBe(500);
    const body = await readBody(response);
    // Matched exactly on purpose: the 500 body must be a fixed string, never
    // anything derived from the thrown error. Changing the copy should be a
    // deliberate act that updates this line, not something that slips through.
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something broke on our side. Nothing you did — try again in a moment.',
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});

describe('buildPaginationMeta', () => {
  it('rounds partial pages up and never reports zero pages', () => {
    expect(buildPaginationMeta(1, 10, 25)).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
    expect(buildPaginationMeta(1, 10, 0).totalPages).toBe(1);
  });
});
