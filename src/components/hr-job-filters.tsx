import Link from 'next/link';

import { JOB_STATUSES, JOB_STATUS_LABELS } from '@/modules/jobs/job.constants';

export function HrJobFilters({ q, status }: { q?: string; status?: string }) {
  return (
    <form method="get" action="/hr/jobs" className="card mb-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="field-label">
            Search my listings
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ''}
            placeholder="Search your titles"
            className="field-input"
          />
        </div>

        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ''} className="field-input">
            <option value="">Any</option>
            {JOB_STATUSES.map((value) => (
              <option key={value} value={value}>
                {JOB_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-mist-200 pt-4">
        <button type="submit" className="btn-primary btn-sm">
          Filter
        </button>
        {q || status ? (
          <Link href="/hr/jobs" className="btn-ghost btn-sm">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
