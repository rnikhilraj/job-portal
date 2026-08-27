/**
 * Dependency-free so it can be imported from the Edge middleware bundle.
 * Anything that pulls in Mongoose cannot be reached from `src/middleware.ts`.
 */
export const SESSION_COOKIE_NAME = 'session';
