import { JobCard } from '@/components/job-card';
import { JobFilters } from '@/components/job-filters';
import { Pagination } from '@/components/pagination';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import { browseJobsQuerySchema } from '@/modules/jobs/job.schema';
import { browseJobs } from '@/modules/jobs/job.service';

export const metadata = { title: 'Browse jobs · Job Application Tracker' };

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

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Open positions</h1>

      <JobFilters q={query.q} location={query.location} jobType={query.jobType} />

      {jobs.length === 0 ? (
        <p className="card text-sm text-slate-600">
          No jobs match these filters. Try a broader search.
        </p>
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
