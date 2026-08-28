'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { patchJson } from '@/lib/http';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/modules/applications/application.constants';

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
      // Says what was kept, since the control has just rolled back visually.
      setError('Status not saved — still showing as before. Try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-start">
      <label htmlFor={`status-${applicationId}`} className="field-label">
        Move to stage
      </label>
      <select
        id={`status-${applicationId}`}
        value={status}
        disabled={isSaving}
        onChange={(event) => handleChange(event.target.value as ApplicationStatus)}
        className="field-input w-full min-h-11 lg:w-52"
      >
        {APPLICATION_STATUSES.map((value) => (
          <option key={value} value={value}>
            {APPLICATION_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {error ? (
        <span className="mt-1.5 text-xs font-medium text-status-rejected">{error}</span>
      ) : null}
    </div>
  );
}
