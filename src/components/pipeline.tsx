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

/** The three forward stages. Rejected is off-path, not a fourth step. */
const FORWARD_STAGES = ['APPLIED', 'REVIEWED', 'SHORTLISTED'] as const;
type ForwardStage = (typeof FORWARD_STAGES)[number];

const STAGE_INDEX: Record<ForwardStage, number> = {
  APPLIED: 0,
  REVIEWED: 1,
  SHORTLISTED: 2,
};

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

/**
 * A single application's position in the pipeline.
 *
 * Rejected renders the track as terminated after the stage it stopped at,
 * rather than as a fourth position, because that is what actually happened.
 */
export function PipelineRail({
  status,
  className = '',
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const isRejected = status === 'REJECTED';
  const reachedIndex = isRejected ? 0 : STAGE_INDEX[status as ForwardStage];

  const description = isRejected
    ? 'Rejected after review'
    : `${APPLICATION_STATUS_LABELS[status]} — stage ${reachedIndex + 1} of 3`;

  return (
    <div className={className}>
      <p className="sr-only">{description}</p>

      <ol className="flex items-center" aria-hidden="true">
        {FORWARD_STAGES.map((stage, index) => {
          const reached = index <= reachedIndex;
          const isCurrent = index === reachedIndex && !isRejected;
          const segmentFilled = index <= reachedIndex && index > 0;

          return (
            <li
              key={stage}
              className={index === 0 ? 'flex items-center' : 'flex flex-1 items-center'}
            >
              {index > 0 ? (
                <span
                  className={`h-0.5 flex-1 ${
                    isRejected
                      ? 'bg-mist-300'
                      : segmentFilled
                        ? 'bg-petrol-500'
                        : 'bg-mist-300'
                  }`}
                />
              ) : null}

              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full
                  border text-[0.625rem] font-semibold leading-none
                  ${
                    isRejected && index === 0
                      ? 'border-status-rejected bg-status-rejected text-white'
                      : reached
                        ? 'border-petrol-600 bg-petrol-600 text-white'
                        : 'border-mist-400 bg-white text-ink-faint'
                  }
                  ${isCurrent ? 'ring-2 ring-petrol-200' : ''}`}
              >
                {isRejected && index === 0 ? STATUS_ICON.REJECTED : reached ? '✓' : ''}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="mt-1.5 flex justify-between text-[0.6875rem] text-ink-faint"
        aria-hidden="true"
      >
        {FORWARD_STAGES.map((stage, index) => (
          <span
            key={stage}
            className={
              !isRejected && index === reachedIndex ? 'font-semibold text-ink-soft' : undefined
            }
          >
            {APPLICATION_STATUS_LABELS[stage]}
          </span>
        ))}
      </div>

      {isRejected ? (
        <p
          className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] font-medium text-status-rejected"
          aria-hidden="true"
        >
          <span>{STATUS_ICON.REJECTED}</span> Not progressing
        </p>
      ) : null}
    </div>
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
    <div className="card">
      <h2 className="eyebrow">Pipeline</h2>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-mist-200">
        {APPLICATION_STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <div
            key={status}
            className={FUNNEL_BAR[status]}
            style={{ width: `${(counts[status] / total) * 100}%` }}
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
