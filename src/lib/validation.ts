import { z } from 'zod';

/**
 * Rejects malformed ids at the edge so Mongoose never raises a CastError.
 *
 * Matched with a regex rather than `Types.ObjectId.isValid` so this module stays
 * free of Mongoose: it is imported by the zod schemas that client components
 * share, and pulling the driver in would ship it to the browser.
 */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .regex(OBJECT_ID_PATTERN, 'Invalid identifier.');

/**
 * Escapes every regex metacharacter so a search term is matched literally.
 * Without this, user input such as `(a+)+$` would be compiled as a pattern —
 * both a correctness bug and a ReDoS risk.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a case-insensitive "contains" matcher from untrusted input. */
export function containsMatcher(term: string): RegExp {
  return new RegExp(escapeRegExp(term), 'i');
}

export const MAX_PAGE_SIZE = 50;

/** Shared page/limit parsing for every list endpoint. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(10),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Trims a query param and treats an empty string as "not provided". */
export const optionalSearchTerm = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value ? value : undefined));

/** Reads URLSearchParams into a plain object for zod, dropping empty values. */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (value !== '') result[key] = value;
  }
  return result;
}
