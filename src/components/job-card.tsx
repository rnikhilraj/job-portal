import Link from 'next/link';

import { JOB_TYPE_LABELS, type PublicJob } from '@/modules/jobs/job.constants';

function summarise(description: string, maxLength = 180): string {
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength).trimEnd()}…`;
}

export function JobCard({ job }: { job: PublicJob }) {
  return (
    <li className="card-hoverable">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-display-sm font-semibold">
          {/* Stretched link: the whole card is the target, but only one link in the a11y tree. */}
          <Link href={`/jobs/${job.id}`} className="hover:text-petrol-700">
            {job.title}
          </Link>
        </h2>
        <p className="shrink-0 text-xs text-ink-faint">
          {new Date(job.createdAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true">◎</span>
          {job.location}
        </span>
        <span aria-hidden="true" className="text-mist-400">
          ·
        </span>
        <span>{JOB_TYPE_LABELS[job.jobType]}</span>
      </p>

      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
        {summarise(job.description)}
      </p>

      <Link href={`/jobs/${job.id}`} className="link mt-4 inline-block text-sm">
        View details <span aria-hidden="true">→</span>
      </Link>
    </li>
  );
}
