import Link from 'next/link';

import { DeleteJobButton } from '@/components/delete-job-button';
import { EmptyState } from '@/components/empty-state';
import { HrJobFilters } from '@/components/hr-job-filters';
import { Pagination } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';
import { hrJobsQuerySchema } from '@/modules/jobs/job.schema';
import { listJobsForOwner } from '@/modules/jobs/job.service';

export const metadata = { title: 'My listings' };

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
  const isFiltered = Boolean(query.q || query.status);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">My job listings</h1>
          <p className="page-lede">
            Only listings you posted. Open roles are visible to candidates; closed ones are not.
          </p>
        </div>
        <Link href="/hr/jobs/new" className="btn-primary shrink-0">
          <span aria-hidden="true">+</span> Post a job
        </Link>
      </header>

      <HrJobFilters q={query.q} status={query.status} />

      {jobs.length === 0 ? (
        isFiltered ? (
          <EmptyState
            icon="⌕"
            title="No listings match those filters"
            description="Nothing of yours matched that title or status. Clear the filters to see all your listings."
            action={{ href: '/hr/jobs', label: 'Clear filters' }}
          />
        ) : (
          <EmptyState
            icon="◇"
            title="You haven't posted a job yet"
            description="Post your first listing and it will appear here, along with the applicants who apply to it."
            action={{ href: '/hr/jobs/new', label: 'Post a job' }}
          />
        )
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 className="font-display text-display-sm font-semibold">{job.title}</h2>
                  <p className="mt-1.5 text-sm text-ink-muted">
                    {job.location} · {JOB_TYPE_LABELS[job.jobType]} · Posted{' '}
                    {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>

              {/* Actions wrap to their own rows on narrow screens rather than overflowing. */}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-mist-200 pt-4">
                <Link href={`/hr/jobs/${job.id}/applicants`} className="btn-secondary btn-sm">
                  View applicants
                </Link>
                <Link href={`/hr/jobs/${job.id}/edit`} className="btn-secondary btn-sm">
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
