import Link from 'next/link';

import { JOB_TYPE_LABELS, type PublicJob } from '@/modules/jobs/job.model';

function summarise(description: string, maxLength = 180): string {
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength).trimEnd()}…`;
}

export function JobCard({ job }: { job: PublicJob }) {
  return (
    <li className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <Link href={`/jobs/${job.id}`} className="hover:text-brand-600">
            {job.title}
          </Link>
        </h2>
        <p className="text-xs text-slate-500">
          Posted {new Date(job.createdAt).toLocaleDateString()}
        </p>
      </div>

      <p className="mt-1 text-sm text-slate-600">
        {job.location} · {JOB_TYPE_LABELS[job.jobType]}
      </p>

      <p className="mt-3 text-sm text-slate-700">{summarise(job.description)}</p>

      <Link href={`/jobs/${job.id}`} className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        View details →
      </Link>
    </li>
  );
}
