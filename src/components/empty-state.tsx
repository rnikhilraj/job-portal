import Link from 'next/link';

/**
 * Empty states are designed, not left blank: every one says what is missing,
 * why, and what to do next. Used for genuinely-empty collections and for
 * filters that matched nothing, which are different situations.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-mist-400 bg-white px-6 py-12 text-center">
      <p
        aria-hidden="true"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full
          bg-mist-200 text-lg text-ink-muted"
      >
        {icon}
      </p>
      <h2 className="mt-4 font-display text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-muted">
        {description}
      </p>
      {action ? (
        <Link href={action.href} className="btn-primary mt-5">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
