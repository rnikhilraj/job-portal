import { Suspense } from 'react';

import { EmptyState } from '@/components/empty-state';
import { JobCard } from '@/components/job-card';
import { JobFilters } from '@/components/job-filters';
import { Pagination } from '@/components/pagination';
import { SkeletonList } from '@/components/skeleton';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import { browseJobsQuerySchema, type BrowseJobsQuery } from '@/modules/jobs/job.schema';
import { browseJobs } from '@/modules/jobs/job.service';

export const metadata = { title: 'Browse jobs' };

/**
 * Only the result list is wrapped in Suspense, not the whole route.
 *
 * A route-level loading.tsx would place the boundary above this component, so
 * Next would flush a 200 shell before the guard below ran — turning an
 * unauthorised visit into a client-side redirect with the wrong HTTP status.
 * Keeping the boundary here means auth resolves first and only the query
 * streams. The same pattern is used on every list page.
 */
export default async function BrowseJobsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePageUser();

  const rawParams = toQueryRecord(await searchParams);
  // Fall back to page 1 on nonsense input instead of showing an error page.
  const parsed = browseJobsQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : browseJobsQuerySchema.parse({});

  return (
    <>
      <header className="mb-6">
        <h1 className="page-title">Open positions</h1>
        <p className="page-lede">Roles currently accepting applications.</p>
      </header>

      <JobFilters q={query.q} location={query.location} jobType={query.jobType} />

      {/* key remounts the boundary on every filter change, so the skeleton reappears. */}
      <Suspense key={JSON.stringify(query)} fallback={<SkeletonList label="Loading open positions…" />}>
        <JobResults query={query} rawParams={rawParams} />
      </Suspense>
    </>
  );
}

async function JobResults({
  query,
  rawParams,
}: {
  query: BrowseJobsQuery;
  rawParams: Record<string, string>;
}) {
  const { jobs, total } = await browseJobs(query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const isFiltered = Boolean(query.q || query.location || query.jobType);

  if (jobs.length === 0) {
    return isFiltered ? (
      <EmptyState
        icon="⌕"
        title="No roles match those filters"
        description="Nothing matched this combination of keyword, location and job type. Try widening one of them."
        action={{ href: '/jobs', label: 'Clear filters' }}
      />
    ) : (
      <EmptyState
        icon="◇"
        title="No open roles right now"
        description="There are no listings accepting applications at the moment. Check back shortly — new roles appear here as soon as they are posted."
      />
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </ul>
      <Pagination
        page={query.page}
        totalPages={totalPages}
        total={total}
        buildHref={(page) => buildPageHref('/jobs', rawParams, page)}
      />
    </>
  );
}
