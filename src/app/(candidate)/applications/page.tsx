import Link from 'next/link';

import { Pagination } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { APPLICATION_STATUSES } from '@/modules/applications/application.model';
import { myApplicationsQuerySchema } from '@/modules/applications/application.schema';
import { listApplicationsForCandidate } from '@/modules/applications/application.service';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.model';

export const metadata = { title: 'My applications · Job Application Tracker' };

const STATUS_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
};

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const candidate = await requirePageUser('CANDIDATE');

  const rawParams = toQueryRecord(await searchParams);
  const parsed = myApplicationsQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : myApplicationsQuerySchema.parse({});

  const { applications, total } = await listApplicationsForCandidate(candidate._id, query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">My applications</h1>

      <form method="get" action="/applications" className="card mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select id="status" name="status" defaultValue={query.status ?? ''} className="field-input">
            <option value="">Any</option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Filter
        </button>
        {query.status ? (
          <Link href="/applications" className="btn-secondary">
            Clear
          </Link>
        ) : null}
      </form>

      {applications.length === 0 ? (
        <p className="card text-sm text-slate-600">
          You have not applied to anything yet.{' '}
          <Link href="/jobs" className="font-medium text-brand-600 hover:underline">
            Browse open positions
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-4">
          {applications.map((application) => (
            <li key={application.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {application.job ? (
                      <Link href={`/jobs/${application.job.id}`} className="hover:text-brand-600">
                        {application.job.title}
                      </Link>
                    ) : (
                      // The listing was deleted; the application row is kept
                      // so the candidate still sees their own history.
                      <span className="text-slate-500">Listing removed</span>
                    )}
                  </h2>
                  {application.job ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {application.job.location} · {JOB_TYPE_LABELS[application.job.jobType]}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Applied {new Date(application.appliedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={application.status} />
              </div>

              {application.coverNote ? (
                <p className="mt-3 whitespace-pre-line border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
                  {application.coverNote}
                </p>
              ) : null}

              <p className="mt-4 text-sm">
                <a
                  href={`/api/applications/${application.id}/resume`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Download my resume ({application.resume.originalName})
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={query.page}
        totalPages={totalPages}
        total={total}
        buildHref={(page) => buildPageHref('/applications', rawParams, page)}
      />
    </>
  );
}
