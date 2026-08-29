import type { Types } from 'mongoose';
import Link from 'next/link';
import { Suspense } from 'react';

import { DeleteJobButton } from '@/components/delete-job-button';
import { EmptyState } from '@/components/empty-state';
import { HrJobFilters } from '@/components/hr-job-filters';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { SkeletonList } from '@/components/skeleton';
import { StatusBadge } from '@/components/status-badge';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';
import { hrJobsQuerySchema, type HrJobsQuery } from '@/modules/jobs/job.schema';
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

  return (
    <>
      <PageHeader
        eyebrow="Your listings"
        title="My job listings"
        lede="Only roles you posted. Open ones are visible to candidates; closed ones stay here for your records."
        action={
          <Link href="/hr/jobs/new" className="btn-primary">
            <span aria-hidden="true">+</span> Post a listing
          </Link>
        }
      />

      <div className="enter-2">
        <HrJobFilters q={query.q} status={query.status} />
      </div>

      <div className="enter-3">
        <Suspense
          key={JSON.stringify(query)}
          fallback={<SkeletonList label="Loading your listings…" />}
        >
          <OwnedJobResults ownerId={hr._id} query={query} rawParams={rawParams} />
        </Suspense>
      </div>
    </>
  );
}

async function OwnedJobResults({
  ownerId,
  query,
  rawParams,
}: {
  ownerId: Types.ObjectId;
  query: HrJobsQuery;
  rawParams: Record<string, string>;
}) {
  // Scoped to the signed-in HR user at the query level — another HR user's
  // listings are never loaded, let alone rendered.
  const { jobs, total } = await listJobsForOwner(ownerId, query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const isFiltered = Boolean(query.q || query.status);

  return (
    <>
      {jobs.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title="None of your listings match"
            description="None of your listings fit that title or status. Clear the filters to see everything you've posted."
            action={{ href: '/hr/jobs', label: 'Show me everything' }}
          />
        ) : (
          <EmptyState
            title="Your first listing goes here"
            description="Post a listing and this page becomes your pipeline: every applicant, their resume and cover note, and a funnel you can move people through."
            action={{ href: '/hr/jobs/new', label: 'Post the first one' }}
          />
        )
      ) : (
        <ul className="stagger space-y-4">
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
