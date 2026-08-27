/**
 * Next passes `searchParams` as string | string[] | undefined. Repeated params
 * are collapsed to the first value so `?q=a&q=b` cannot smuggle an array into
 * a schema expecting a string.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstValue(value: string | string[] | undefined): string | undefined {
  const result = Array.isArray(value) ? value[0] : value;
  return result === '' ? undefined : result;
}

export function toQueryRecord(params: RawSearchParams): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const single = firstValue(value);
    if (single !== undefined) record[key] = single;
  }
  return record;
}

/** Builds a query string from the current filters with `page` replaced. */
export function buildPageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'page' && value) search.set(key, value);
  }
  if (page > 1) search.set('page', String(page));

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
