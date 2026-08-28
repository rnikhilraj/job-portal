import { JOB_STATUS_LABELS, type JobStatus } from '@/modules/jobs/job.constants';

const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  OPEN: 'bg-status-shortlisted-tint text-status-shortlisted',
  CLOSED: 'bg-status-applied-tint text-status-applied',
};

const JOB_STATUS_ICON: Record<JobStatus, string> = {
  OPEN: '●',
  CLOSED: '⊘',
};

/**
 * Job status. Glyph plus label plus colour, so it survives greyscale and
 * colour vision deficiency — see components/pipeline.tsx for the reasoning.
 */
export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem]
        font-medium ${JOB_STATUS_STYLES[status]}`}
    >
      <span aria-hidden="true" className="text-[0.625rem] leading-none">
        {JOB_STATUS_ICON[status]}
      </span>
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}
