import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/modules/applications/application.constants';

/**
 * The pipeline rail — this app's one signature element.
 *
 * Recruiting's native mental model is a funnel, so status is drawn as a
 * position on a track rather than as a coloured chip alone.
 *
 * This is an accessibility mechanism as much as a visual one. Shortlisted
 * (green) and Rejected (rose) are almost indistinguishable under deuteranopia —
 * measured at a colour distance of 32 with near-identical luminance — so the
 * rail deliberately encodes state in three channels that survive without hue:
 * how far the track is filled, the glyph at each node, and the text label.
 * Colour is the fourth, confirmatory layer.
 */

export const STATUS_ICON: Record<ApplicationStatus, string> = {
  APPLIED: '○',
  REVIEWED: '◍',
  SHORTLISTED: '✓',
  REJECTED: '✕',
};

const STATUS_TEXT: Record<ApplicationStatus, string> = {
  APPLIED: 'text-status-applied',
  REVIEWED: 'text-status-reviewed',
  SHORTLISTED: 'text-status-shortlisted',
  REJECTED: 'text-status-rejected',
};

const STATUS_TINT: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-status-applied-tint',
  REVIEWED: 'bg-status-reviewed-tint',
  SHORTLISTED: 'bg-status-shortlisted-tint',
  REJECTED: 'bg-status-rejected-tint',
};

/**
 * Status as a chip: glyph, then label, then colour. Readable with hue removed.
 */
export function StatusChip({
  status,
  size = 'md',
}: {
  status: ApplicationStatus;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium
        ${STATUS_TINT[status]} ${STATUS_TEXT[status]}
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[0.8125rem]'}`}
    >
      <span aria-hidden="true" className="leading-none">
        {STATUS_ICON[status]}
      </span>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

const FUNNEL_BAR: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-status-applied',
  REVIEWED: 'bg-status-reviewed',
  SHORTLISTED: 'bg-status-shortlisted',
  REJECTED: 'bg-status-rejected',
};

/**
 * The same language aggregated: the shape of one listing's pipeline at a
 * glance. Counts are printed next to every segment, so the bar is a summary of
 * the numbers rather than the only way to read them.
 */
export function PipelineFunnel({
  counts,
  total,
}: {
  counts: Record<ApplicationStatus, number>;
  total: number;
}) {
  if (total === 0) return null;

  return (
    <div className="panel-feature p-5">
      <h2 className="eyebrow">Pipeline</h2>

      {/*
        Segments draw in left to right, in the order candidates actually move
        through the funnel — the entrance encodes flow direction rather than
        being decoration. Pure CSS, so this stays a server component.
      */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-mist-200">
        {APPLICATION_STATUSES.filter((status) => counts[status] > 0).map((status, index) => (
          <div
            key={status}
            className={`${FUNNEL_BAR[status]} origin-left`}
            style={{
              width: `${(counts[status] / total) * 100}%`,
              animation: `funnel-fill 620ms cubic-bezier(0.22,0.68,0.36,1) ${index * 110}ms both`,
            }}
          />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {APPLICATION_STATUSES.map((status) => (
          <div key={status} className="flex items-baseline gap-2">
            <dt className="sr-only">{APPLICATION_STATUS_LABELS[status]}</dt>
            <dd className="flex items-baseline gap-2">
              <span className="font-display text-xl font-semibold tabular-nums text-ink">
                {counts[status]}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-medium ${STATUS_TEXT[status]}`}
              >
                <span aria-hidden="true">{STATUS_ICON[status]}</span>
                {APPLICATION_STATUS_LABELS[status]}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
