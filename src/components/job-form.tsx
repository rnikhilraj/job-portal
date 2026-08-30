'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/alert';
import { TextField } from '@/components/text-field';
import { ApiRequestError, patchJson, postJson } from '@/lib/http';
import {
  JOB_STATUSES,
  JOB_TYPES,
  JOB_TYPE_LABELS,
  type JobStatus,
  type JobType,
  type PublicJob,
} from '@/modules/jobs/job.constants';
import { createJobSchema } from '@/modules/jobs/job.schema';

const STATUS_LABELS: Record<JobStatus, string> = {
  OPEN: 'Open — candidates can see and apply',
  CLOSED: 'Closed — hidden, but kept on file',
};

/** Shared by the create and edit pages; `job` decides which. */
export function JobForm({ job }: { job?: PublicJob }) {
  const router = useRouter();
  const isEditing = Boolean(job);

  const [title, setTitle] = useState(job?.title ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [location, setLocation] = useState(job?.location ?? '');
  const [jobType, setJobType] = useState<JobType>(job?.jobType ?? 'FULL_TIME');
  const [status, setStatus] = useState<JobStatus>(job?.status ?? 'OPEN');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = createJobSchema.safeParse({ title, description, location, jobType, status });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      if (job) {
        await patchJson<PublicJob>(`/api/jobs/${job.id}`, parsed.data);
      } else {
        await postJson<PublicJob>('/api/jobs', parsed.data);
      }
      router.push('/hr/jobs');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server — nothing was saved. Check your connection and try again.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <TextField
        label="Title"
        name="title"
        value={title}
        onChange={setTitle}
        errors={fieldErrors.title}
        required
      />

      <div>
        <label htmlFor="description" className="field-label">
          Description
          <span className="ml-0.5 text-status-rejected" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={10}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={Boolean(fieldErrors.description?.length)}
          aria-describedby={
            fieldErrors.description?.length ? 'description-error' : 'description-hint'
          }
          className={`field-input ${fieldErrors.description?.length ? 'border-status-rejected' : ''}`}
        />
        {fieldErrors.description?.length ? (
          <p id="description-error" className="field-error">
            <span aria-hidden="true">✕</span>
            <span>{fieldErrors.description.join(' ')}</span>
          </p>
        ) : (
          <p id="description-hint" className="field-hint">
            Candidates read this in full. What the work actually involves beats a list of
            adjectives.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="Location"
          name="location"
          value={location}
          onChange={setLocation}
          errors={fieldErrors.location}
          required
        />

        <div>
          <label htmlFor="jobType" className="field-label">
            Job type
          </label>
          <select
            id="jobType"
            name="jobType"
            value={jobType}
            onChange={(event) => setJobType(event.target.value as JobType)}
            className="field-input"
          >
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {JOB_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="field-label">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus)}
            className="field-input"
          >
            {JOB_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-mist-200 pt-5">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Post this role'}
        </button>
        <button type="button" onClick={() => router.push('/hr/jobs')} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
