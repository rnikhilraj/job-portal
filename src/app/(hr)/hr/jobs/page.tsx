import Link from 'next/link';

import { DeleteJobButton } from '@/components/delete-job-button';
import { HrJobFilters } from '@/components/hr-job-filters';
import { Pagination } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.model';
import { hrJobsQuerySchema } from '@/modules/jobs/job.schema';
import { listJobsForOwner } from '@/modules/jobs/job.service';

export const metadata = { title: 'My listings · Job Application Tracker' };

export default async function HrJobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const hr = await requirePageUser('HR');

  const rawParams = toQueryRecord(await searchParams);
  const parsed = hrJobsQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : hrJobsQuerySchema.parse({});

  // Scoped to the signed-in HR user at the query level — another HR user's
  // listings are never loaded, let alone rendered.
  const { jobs, total } = await listJobsForOwner(hr._id, query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">My job listings</h1>
        <Link href="/hr/jobs/new" className="btn-primary">
          Post a job
        </Link>
      </div>

      <HrJobFilters q={query.q} status={query.status} />

      {jobs.length === 0 ? (
        <p className="card text-sm text-slate-600">
          No listings match these filters.{' '}
          <Link href="/hr/jobs/new" className="font-medium text-brand-600 hover:underline">
            Post your first job
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{job.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {job.location} · {JOB_TYPE_LABELS[job.jobType]} · Posted{' '}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/hr/jobs/${job.id}/applicants`} className="btn-secondary">
                  View applicants
                </Link>
                <Link href={`/hr/jobs/${job.id}/edit`} className="btn-secondary">
                  Edit
                </Link>
                <DeleteJobButton jobId={job.id} jobTitle={job.title} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={query.page}
        totalPages={totalPages}
        total={total}
        buildHref={(page) => buildPageHref('/hr/jobs', rawParams, page)}
      />
    </>
  );
}
