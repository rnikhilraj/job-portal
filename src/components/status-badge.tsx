/**
 * Covers both job statuses and application statuses. Declared locally rather
 * than imported so a shared presentational component does not couple the two
 * domain modules together.
 */
export type BadgeStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'APPLIED'
  | 'REVIEWED'
  | 'SHORTLISTED'
  | 'REJECTED';

const STATUS_CLASSES: Record<BadgeStatus, string> = {
  OPEN: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-200 text-slate-700',
  APPLIED: 'bg-blue-100 text-blue-800',
  REVIEWED: 'bg-amber-100 text-amber-800',
  SHORTLISTED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<BadgeStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
  APPLIED: 'Applied',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
