import Link from 'next/link';

import { Pagination } from '@/components/pagination';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from '@/modules/users/user.constants';
import { candidateSearchQuerySchema } from '@/modules/users/user.schema';
import { searchCandidates } from '@/modules/users/user.service';

export const metadata = { title: 'Candidate search · Job Application Tracker' };

/**
 * HR-only directory of candidates who have opted in.
 *
 * The opt-in filter is not applied here — searchCandidates() pins it — so this
 * page cannot accidentally widen the result set.
 */
export default async function CandidateSearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requirePageUser('HR');

  const rawParams = toQueryRecord(await searchParams);
  const parsed = candidateSearchQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : candidateSearchQuerySchema.parse({});

  const { candidates, total } = await searchCandidates(query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Candidate search</h1>
      <p className="mb-6 text-sm text-slate-600">
        Candidates who have opted in to being found by recruiters. Contact details and resumes
        are not shown here — those are visible only for people who apply to your listings.
      </p>

      <form method="get" action="/hr/candidates" className="card mb-6 grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="field-label">
            Keyword
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query.q ?? ''}
            placeholder="Name, headline or skill"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="experienceLevel" className="field-label">
            Experience level
          </label>
          <select
            id="experienceLevel"
            name="experienceLevel"
            defaultValue={query.experienceLevel ?? ''}
            className="field-input"
          >
            <option value="">Any</option>
            {EXPERIENCE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EXPERIENCE_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary">
            Search
          </button>
          {query.q || query.experienceLevel ? (
            <Link href="/hr/candidates" className="btn-secondary">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {candidates.length === 0 ? (
        <p className="card text-sm text-slate-600">
          No opted-in candidates match these filters. Only candidates who have enabled recruiter
          visibility on their profile appear here.
        </p>
      ) : (
        <ul className="space-y-4">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{candidate.name}</h2>
                  {candidate.headline ? (
                    <p className="mt-1 text-sm text-slate-700">{candidate.headline}</p>
                  ) : null}
                </div>
                {candidate.experienceLevel ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {EXPERIENCE_LEVEL_LABELS[candidate.experienceLevel]}
                  </span>
                ) : null}
              </div>

              {candidate.skills.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={query.page}
        totalPages={totalPages}
        total={total}
        buildHref={(page) => buildPageHref('/hr/candidates', rawParams, page)}
      />
    </>
  );
}
