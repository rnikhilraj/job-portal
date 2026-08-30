import Link from 'next/link';

import { JOB_TYPES, JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';

type JobFiltersProps = {
  q?: string;
  location?: string;
  jobType?: string;
};

/**
 * A plain GET form: filtering is expressed entirely in the URL, so results are
 * shareable, bookmarkable and work without client-side JavaScript. Fields stack
 * to full width on mobile and settle into four columns from sm up.
 */
export function JobFilters({ q, location, jobType }: JobFiltersProps) {
  const hasFilters = Boolean(q || location || jobType);

  return (
    <form method="get" action="/jobs" className="card mb-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="field-label">
            Keyword
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Role, skill, anything"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="location" className="field-label">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="search"
            defaultValue={location ?? ''}
            placeholder="City, or Remote"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="jobType" className="field-label">
            Role type
          </label>
          <select id="jobType" name="jobType" defaultValue={jobType ?? ''} className="field-input">
            <option value="">Any</option>
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {JOB_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-mist-200 pt-4">
        <button type="submit" className="btn-primary btn-sm">
          Search
        </button>
        {hasFilters ? (
          <Link href="/jobs" className="btn-ghost btn-sm">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
