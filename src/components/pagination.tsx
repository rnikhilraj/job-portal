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
      className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm"
    >
      <p className="text-slate-600">
        Page {page} of {totalPages} · {total} result{total === 1 ? '' : 's'}
      </p>

      <div className="flex gap-2">
        {hasPrevious ? (
          <Link href={buildHref(page - 1)} className="btn-secondary" rel="prev">
            Previous
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none opacity-50">Previous</span>
        )}
        {hasNext ? (
          <Link href={buildHref(page + 1)} className="btn-secondary" rel="next">
            Next
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none opacity-50">Next</span>
        )}
      </div>
    </nav>
  );
}
