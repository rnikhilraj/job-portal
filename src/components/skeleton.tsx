/**
 * Loading placeholders that mirror the shape of the content they stand in for,
 * so the page does not reflow when data arrives. Marked aria-hidden with a
 * polite status message alongside, so screen readers hear "Loading" once
 * instead of reading a wall of empty boxes.
 */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-mist-200 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <li className="card" aria-hidden="true">
      <SkeletonLine className="h-5 w-1/2" />
      <SkeletonLine className="mt-3 h-3.5 w-1/3" />
      <SkeletonLine className="mt-4 h-3 w-full" />
      <SkeletonLine className="mt-2 h-3 w-11/12" />
      <SkeletonLine className="mt-2 h-3 w-2/3" />
    </li>
  );
}

export function SkeletonList({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>
      <ul className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </ul>
    </>
  );
}

export function SkeletonPage({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <>
      <div aria-hidden="true" className="mb-6">
        <SkeletonLine className="h-8 w-64" />
        <SkeletonLine className="mt-3 h-3.5 w-80 max-w-full" />
      </div>
      <div aria-hidden="true" className="card mb-6">
        <SkeletonLine className="h-11 w-full" />
      </div>
      <SkeletonList label={label} rows={rows} />
    </>
  );
}
