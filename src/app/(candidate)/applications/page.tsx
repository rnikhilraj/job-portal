import type { Types } from 'mongoose';
import Link from 'next/link';
import { Suspense } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { StatusChip } from '@/components/pipeline';
import { PipelineRail } from '@/components/pipeline-rail';
import { SkeletonList } from '@/components/skeleton';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from '@/modules/applications/application.constants';
import {
  myApplicationsQuerySchema,
  type MyApplicationsQuery,
} from '@/modules/applications/application.schema';
import { listApplicationsForCandidate } from '@/modules/applications/application.service';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';

export const metadata = { title: 'My applications' };

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const candidate = await requirePageUser('CANDIDATE');

  const rawParams = toQueryRecord(await searchParams);
  const parsed = myApplicationsQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : myApplicationsQuerySchema.parse({});

  return (
    <>
      <header className="mb-6">
        <h1 className="page-title">My applications</h1>
        <p className="page-lede">
          Where each of your applications currently stands. Recruiters move you along the
          pipeline; this updates as they do.
        </p>
      </header>

      <form
        method="get"
        action="/applications"
        className="card mb-6 flex flex-col gap-4 sm:flex-row sm:items-end"
      >
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="status" className="field-label">
            Filter by stage
          </label>
          <select id="status" name="status" defaultValue={query.status ?? ''} className="field-input">
            <option value="">All stages</option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APPLICATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary btn-sm">
            Apply filter
          </button>
          {query.status ? (
            <Link href="/applications" className="btn-ghost btn-sm">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {/* Boundary sits below the guard so auth resolves before the first flush. */}
      <Suspense
        key={JSON.stringify(query)}
        fallback={<SkeletonList label="Loading your applications…" />}
      >
        <ApplicationResults
          candidateId={candidate._id}
          query={query}
          rawParams={rawParams}
        />
      </Suspense>
    </>
  );
}

async function ApplicationResults({
  candidateId,
  query,
  rawParams,
}: {
  candidateId: Types.ObjectId;
  query: MyApplicationsQuery;
  rawParams: Record<string, string>;
}) {
  const { applications, total } = await listApplicationsForCandidate(candidateId, query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return (
    <>
      {applications.length === 0 ? (
        query.status ? (
          <EmptyState
            title={`Nothing at the ${APPLICATION_STATUS_LABELS[query.status].toLowerCase()} stage`}
            description="No application of yours is sitting here right now. Clear the filter to see where they all actually are."
            action={{ href: '/applications', label: 'Show all applications' }}
          />
        ) : (
          <EmptyState
            title="Your pipeline starts with one application"
            description="Apply to a role and it lands here, with its own rail. You will see it move from applied to reviewed to shortlisted as it happens — no refreshing an inbox and hoping."
            action={{ href: '/jobs', label: 'Browse open positions' }}
            secondary={{ href: '/profile', label: 'Set up your profile first' }}
          />
        )
      ) : (
        <ul className="stagger space-y-4">
          {applications.map((application) => (
            <li key={application.id} className="card">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className="font-display text-display-sm font-semibold">
                      {application.job ? (
                        <Link href={`/jobs/${application.job.id}`} className="hover:text-petrol-700">
                          {application.job.title}
                        </Link>
                      ) : (
                        // The listing was deleted; the application row is kept
                        // so the candidate still sees their own history.
                        <span className="text-ink-muted">Listing removed</span>
                      )}
                    </h2>
                    <StatusChip status={application.status} size="sm" />
                  </div>

                  {application.job ? (
                    <p className="mt-1.5 text-sm text-ink-muted">
                      {application.job.location} · {JOB_TYPE_LABELS[application.job.jobType]}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm text-ink-muted">
                      This role was taken down, but your application is kept here for reference.
                    </p>
                  )}

                  <p className="mt-1 text-xs text-ink-faint">
                    Applied {new Date(application.appliedAt).toLocaleDateString()}
                  </p>
                </div>

                {/*
                  applicationId lets the rail animate a status change the first
                  time this viewer sees it, then stay calm on every later load.
                */}
                <PipelineRail
                  status={application.status}
                  applicationId={application.id}
                  className="w-full shrink-0 sm:w-56 lg:w-64"
                />
              </div>

              {application.coverNote ? (
                <p
                  className="mt-4 max-w-prose whitespace-pre-line border-l-2 border-mist-300 pl-3.5
                    text-sm leading-relaxed text-ink-soft"
                >
                  {application.coverNote}
                </p>
              ) : null}

              <p className="mt-4 border-t border-mist-200 pt-4 text-sm">
                <a href={`/api/applications/${application.id}/resume`} className="link">
                  <span aria-hidden="true">↓</span> {application.resume.originalName}
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
