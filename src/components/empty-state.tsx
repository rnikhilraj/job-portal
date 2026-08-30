import Link from 'next/link';

/**
 * Empty states are designed as invitations, not blank space.
 *
 * Each one carries a ghosted pipeline rail — the product's own signature
 * element, drained of colour. It says what this space is *for* before there is
 * any content in it, which a generic icon cannot, and it makes the transition
 * from empty to populated feel like the same object filling up rather than one
 * thing being replaced by another.
 */
function GhostRail() {
  return (
    <div aria-hidden="true" className="mx-auto mb-6 w-full max-w-[13rem] opacity-60">
      <div className="relative">
        <div className="absolute left-2 right-2 top-2 h-0.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,theme(colors.mist.400)_0_4px,transparent_4px_8px)]" />
        <ol className="relative flex items-center justify-between">
          {[0, 1, 2].map((node) => (
            <li
              key={node}
              className="h-4 w-4 rounded-full border border-dashed border-mist-400 bg-white"
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  secondary,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
  /** A quieter alternative, for when the primary action is not the only route. */
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="rounded-card border border-dashed border-mist-400 bg-white px-6 py-12 text-center">
      <GhostRail />

      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>

      {action || secondary ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action ? (
            <Link href={action.href} className="btn-primary">
              {action.label}
            </Link>
          ) : null}
          {secondary ? (
            <Link href={secondary.href} className="btn-ghost">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
