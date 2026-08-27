'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { patchJson } from '@/lib/http';
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from '@/modules/applications/application.model';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  REVIEWED: 'Reviewed',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Rejected',
};

/** Inline status control on the applicants table. */
export function ApplicantStatusSelect({
  applicationId,
  status: initialStatus,
}: {
  applicationId: string;
  status: ApplicationStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: ApplicationStatus) {
    const previous = status;
    setStatus(next);
    setIsSaving(true);
    setError(null);

    try {
      await patchJson(`/api/applications/${applicationId}`, { status: next });
      router.refresh();
    } catch {
      // Roll back so the control never shows a status the server did not accept.
      setStatus(previous);
      setError('Could not update status.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <label htmlFor={`status-${applicationId}`} className="sr-only">
        Application status
      </label>
      <select
        id={`status-${applicationId}`}
        value={status}
        disabled={isSaving}
        onChange={(event) => handleChange(event.target.value as ApplicationStatus)}
        className="field-input w-44 py-1.5"
      >
        {APPLICATION_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
