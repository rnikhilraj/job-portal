import Link from 'next/link';
import { Suspense } from 'react';

import { CandidateSummary } from '@/components/candidate-summary';
import { EmptyState } from '@/components/empty-state';
import { SkeletonList } from '@/components/skeleton';

import { Pagination } from '@/components/pagination';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { requirePageUser } from '@/modules/auth/session';
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from '@/modules/users/user.constants';
import {
  candidateSearchQuerySchema,
  type CandidateSearchQuery,
} from '@/modules/users/user.schema';
import { searchCandidates } from '@/modules/users/user.service';

export const metadata = { title: 'Candidate search' };

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

  return (
    <>
      <h1 className="page-title">Candidate search</h1>
      <p className="page-lede mb-6">
        Candidates who have chosen to be found by recruiters. Each of them has explicitly agreed
        to share their contact details and resume here. Anyone who has not opted in does not
        appear, and their details are never shown.
      </p>

      <form method="get" action="/hr/candidates" className="card mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
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

        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-mist-200 pt-4">
          <button type="submit" className="btn-primary btn-sm">
            Search
          </button>
          {query.q || query.experienceLevel ? (
            <Link href="/hr/candidates" className="btn-ghost btn-sm">
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      <Suspense key={JSON.stringify(query)} fallback={<SkeletonList label="Loading candidates…" />}>
        <CandidateResults query={query} rawParams={rawParams} />
      </Suspense>
    </>
  );
}

async function CandidateResults({
  query,
  rawParams,
}: {
  query: CandidateSearchQuery;
  rawParams: Record<string, string>;
}) {
  const { candidates, total } = await searchCandidates(query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));

  return (
    <>
      {candidates.length === 0 ? (
        query.q || query.experienceLevel ? (
          <EmptyState
            icon="⌕"
            title="No opted-in candidates match those filters"
            description="Nobody who has enabled recruiter visibility matches that keyword or experience level. Candidates who have not opted in never appear here, however well they match."
            action={{ href: '/hr/candidates', label: 'Clear filters' }}
          />
        ) : (
          <EmptyState
            icon="◇"
            title="No candidates are discoverable yet"
            description="This directory only lists candidates who have turned on recruiter visibility on their own profile. Nobody has opted in so far."
          />
        )
      ) : (
        <ul className="space-y-4">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="card-interactive">
              <CandidateSummary candidate={candidate} headingLevel="h2" />
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
