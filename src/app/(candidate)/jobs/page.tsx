import { EmptyState } from '@/components/empty-state';
import { JobCard } from '@/components/job-card';
import { JobFilters } from '@/components/job-filters';
import { Pagination } from '@/components/pagination';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import { browseJobsQuerySchema } from '@/modules/jobs/job.schema';
import { browseJobs } from '@/modules/jobs/job.service';

export const metadata = { title: 'Browse jobs' };

/**
 * Server component. It calls the jobs service directly — the same module the
 * API routes use — rather than making an HTTP round trip to our own API.
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

  const { jobs, total } = await browseJobs(query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const isFiltered = Boolean(query.q || query.location || query.jobType);

  return (
    <>
      <header className="mb-6">
        <h1 className="page-title">Open positions</h1>
        <p className="page-lede">
          {total > 0
            ? `${total} role${total === 1 ? '' : 's'} currently accepting applications.`
            : 'Roles accepting applications will appear here.'}
        </p>
      </header>

      <JobFilters q={query.q} location={query.location} jobType={query.jobType} />

      {jobs.length === 0 ? (
        isFiltered ? (
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
        )
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}

      <Pagination
        page={query.page}
        totalPages={totalPages}
        total={total}
        buildHref={(page) => buildPageHref('/jobs', rawParams, page)}
      />
    </>
  );
}
