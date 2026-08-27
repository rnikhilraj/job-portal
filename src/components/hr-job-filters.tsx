import Link from 'next/link';

import { JOB_STATUSES } from '@/modules/jobs/job.model';

const STATUS_LABELS: Record<string, string> = { OPEN: 'Open', CLOSED: 'Closed' };

export function HrJobFilters({ q, status }: { q?: string; status?: string }) {
  return (
    <form method="get" action="/hr/jobs" className="card mb-6 grid gap-4 sm:grid-cols-4">
      <div className="sm:col-span-2">
        <label htmlFor="q" className="field-label">
          Search my listings
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="Job title"
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
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <button type="submit" className="btn-primary">
          Filter
        </button>
        {q || status ? (
          <Link href="/hr/jobs" className="btn-secondary">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
