'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Alert } from '@/components/alert';
import { ApiRequestError, apiFetch } from '@/lib/http';
import { applyToJobSchema } from '@/modules/applications/application.schema';

const PDF_CONTENT_TYPE = 'application/pdf';

type ApplyFormProps = {
  jobId: string;
  maxResumeBytes: number;
};

function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / (1024 * 1024))} MB`;
}

/**
 * Client-side checks here are a courtesy — they save a round trip and give
 * immediate feedback. The server repeats every one of them, and inspects the
 * file's bytes rather than its declared type, so nothing depends on this code.
 */
export function ApplyForm({ jobId, maxResumeBytes }: ApplyFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [coverNote, setCoverNote] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setFieldErrors({ resume: ['Pick a PDF before sending this.'] });
      return;
    }
    if (file.type !== PDF_CONTENT_TYPE) {
      setFieldErrors({ resume: ['Only PDF resumes are accepted.'] });
      return;
    }
    if (file.size > maxResumeBytes) {
      setFieldErrors({ resume: [`Resume must be ${formatMegabytes(maxResumeBytes)} or smaller.`] });
      return;
    }

    const parsed = applyToJobSchema.safeParse({ coverNote });
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }

    const body = new FormData();
    body.set('resume', file);
    if (parsed.data.coverNote) body.set('coverNote', parsed.data.coverNote);

    setIsSubmitting(true);
    try {
      // No content-type header: the browser sets the multipart boundary itself.
      await apiFetch(`/api/jobs/${jobId}/applications`, { method: 'POST', body });
      router.push('/applications');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Could not reach the server — your application was not submitted. Check your connection and try again.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <div>
        <label htmlFor="resume" className="field-label">
          Resume (PDF)
          <span className="ml-0.5 text-status-rejected" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="resume"
          name="resume"
          type="file"
          accept="application/pdf,.pdf"
          ref={fileInputRef}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          aria-invalid={Boolean(fieldErrors.resume?.length)}
          className={`field-input py-2.5 file:mr-3 file:rounded file:border-0 file:bg-mist-200
            file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-soft
            ${fieldErrors.resume?.length ? 'border-status-rejected' : ''}`}
        />
        {fieldErrors.resume?.length ? (
          <p className="field-error">
            <span aria-hidden="true">✕</span>
            <span>{fieldErrors.resume.join(' ')}</span>
          </p>
        ) : (
          <p className="field-hint">
            {fileName
              ? `${fileName} — looks good.`
              : `PDF only, up to ${formatMegabytes(maxResumeBytes)}. The one you actually want them to read.`}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="coverNote" className="field-label">
          Cover note (optional)
        </label>
        <textarea
          id="coverNote"
          name="coverNote"
          rows={5}
          maxLength={2000}
          value={coverNote}
          onChange={(event) => setCoverNote(event.target.value)}
          placeholder="Optional. It sits beside your resume when a recruiter opens this."
          className={`field-input ${fieldErrors.coverNote?.length ? 'border-status-rejected' : ''}`}
        />
        {fieldErrors.coverNote?.length ? (
          <p className="field-error">
            <span aria-hidden="true">✕</span>
            <span>{fieldErrors.coverNote.join(' ')}</span>
          </p>
        ) : (
          <p className="field-hint">
            {coverNote.length === 0
              ? 'Why this role, in a few sentences. Nobody is counting words.'
              : `${coverNote.length} of 2000 characters.`}
          </p>
        )}
      </div>

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Sending it over…' : 'Send my application'}
      </button>
    </form>
  );
}
