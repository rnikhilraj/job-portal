import Link from 'next/link';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  /** Current query string params, minus `page`, preserved across navigation. */
  buildHref: (page: number) => string;
};

export function Pagination({ page, totalPages, total, buildHref }: PaginationProps) {
  if (total === 0) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-col-reverse gap-3 border-t border-mist-300 pt-5
        sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-ink-muted">
        Page <span className="font-medium text-ink">{page}</span> of {totalPages}
        <span aria-hidden="true" className="mx-2 text-mist-400">
          ·
        </span>
        {total} result{total === 1 ? '' : 's'}
      </p>

      <div className="flex gap-2">
        {hasPrevious ? (
          <Link href={buildHref(page - 1)} className="btn-secondary btn-sm" rel="prev">
            <span aria-hidden="true">←</span> Previous
          </Link>
        ) : (
          <span className="btn-secondary btn-sm pointer-events-none opacity-45" aria-hidden="true">
            <span>←</span> Previous
          </span>
        )}
        {hasNext ? (
          <Link href={buildHref(page + 1)} className="btn-secondary btn-sm" rel="next">
            Next <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="btn-secondary btn-sm pointer-events-none opacity-45" aria-hidden="true">
            Next <span>→</span>
          </span>
        )}
      </div>
    </nav>
  );
}
