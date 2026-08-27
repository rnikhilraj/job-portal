import Link from 'next/link';

import { JOB_TYPES, JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';

type JobFiltersProps = {
  q?: string;
  location?: string;
  jobType?: string;
};

/**
 * A plain GET form: filtering is expressed entirely in the URL, so results are
 * shareable, bookmarkable and work without client-side JavaScript.
 */
export function JobFilters({ q, location, jobType }: JobFiltersProps) {
  const hasFilters = Boolean(q || location || jobType);

  return (
    <form method="get" action="/jobs" className="card mb-6 grid gap-4 sm:grid-cols-4">
      <div className="sm:col-span-2">
        <label htmlFor="q" className="field-label">
          Keyword
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="Title or description"
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
          placeholder="e.g. Remote"
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="jobType" className="field-label">
          Job type
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

      <div className="flex items-end gap-2 sm:col-span-4">
        <button type="submit" className="btn-primary">
          Search
        </button>
        {hasFilters ? (
          <Link href="/jobs" className="btn-secondary">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
