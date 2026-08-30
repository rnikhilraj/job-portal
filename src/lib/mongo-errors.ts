/**
 * Predicates for the driver errors this app maps to a status code.
 *
 * Mongoose reports these by shape rather than by exported error class, so the
 * checks are structural. They live here rather than in `lib/api/route.ts`
 * because two layers need them and the dependency may only run one way: the
 * route wrapper turns them into HTTP statuses, while `application.service`
 * catches E11000 itself to delete the orphaned upload before rethrowing it as a
 * conflict. A domain service must not import from the API layer to get that, so
 * both import from here.
 */

/** Shape of the duplicate-key error Mongo raises against a unique index. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Raised when a string cannot be coerced to the schema's type — a bad ObjectId. */
export function isCastError(error: unknown): boolean {
  return error instanceof Error && error.name === 'CastError';
}

/** Raised when a document fails the model's own validators on save. */
export function isMongooseValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ValidationError';
}
