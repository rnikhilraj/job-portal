import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApplicantStatusSelect } from '@/components/applicant-status-select';
import { Pagination } from '@/components/pagination';
import { AppError } from '@/lib/api/errors';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { objectIdSchema } from '@/lib/validation';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from '@/modules/applications/application.constants';
import { applicantsQuerySchema } from '@/modules/applications/application.schema';
import { listApplicantsForJob } from '@/modules/applications/application.service';
import { requirePageUser } from '@/modules/auth/session';
import { findOwnedJobOrFail } from '@/modules/jobs/job.service';

export const metadata = { title: 'Applicants · Job Application Tracker' };

export default async function ApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const hr = await requirePageUser('HR');

  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  // Ownership is resolved before anything is rendered; another HR user's
  // listing produces a 404 here rather than an applicant list.
  let job;
  try {
    job = await findOwnedJobOrFail(id, hr._id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  const rawParams = toQueryRecord(await searchParams);
  const parsed = applicantsQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : applicantsQuerySchema.parse({});

  const { applicants, total } = await listApplicantsForJob(id, hr._id, query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const basePath = `/hr/jobs/${id}/applicants`;

  return (
    <>
      <Link href="/hr/jobs" className="text-sm text-brand-600 hover:underline">
        ← Back to my listings
      </Link>

      <h1 className="mb-1 mt-4 text-2xl font-semibold">Applicants</h1>
      <p className="mb-6 text-sm text-slate-600">
        {job.title} · {job.location}
      </p>

      <form method="get" action={basePath} className="card mb-6 grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="field-label">
            Candidate name
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query.q ?? ''}
            placeholder="Search applicants"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select id="status" name="status" defaultValue={query.status ?? ''} className="field-input">
            <option value="">Any</option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APPLICATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary">
            Filter
          </button>
          {query.q || query.status ? (
            <Link href={basePath} className="btn-secondary">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {applicants.length === 0 ? (
        <p className="card text-sm text-slate-600">No applicants match these filters.</p>
      ) : (
        <ul className="space-y-4">
          {applicants.map((applicant) => (
            <li key={applicant.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {applicant.candidate?.name ?? 'Candidate removed'}
                  </h2>
                  {applicant.candidate ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {applicant.candidate.email}
                      {applicant.candidate.phone ? ` · ${applicant.candidate.phone}` : ''}
                    </p>
                  ) : null}
                  {applicant.candidate?.headline ? (
                    <p className="mt-1 text-sm text-slate-700">{applicant.candidate.headline}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Applied {new Date(applicant.appliedAt).toLocaleDateString()}
                  </p>
                </div>

                <ApplicantStatusSelect applicationId={applicant.id} status={applicant.status} />
              </div>

              {applicant.candidate?.skills.length ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {applicant.candidate.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : null}

              {applicant.coverNote ? (
                <p className="mt-3 whitespace-pre-line border-l-2 border-slate-200 pl-3 text-sm text-slate-700">
                  {applicant.coverNote}
                </p>
              ) : null}

              <p className="mt-4 text-sm">
                <a
                  href={`/api/applications/${applicant.id}/resume`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  Download resume ({applicant.resume.originalName})
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
        buildHref={(page) => buildPageHref(basePath, rawParams, page)}
      />
    </>
  );
}
