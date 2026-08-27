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
      setFieldErrors({ resume: ['Attach your resume as a PDF.'] });
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
        setFormError('Could not reach the server. Please try again.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <div>
        <label htmlFor="resume" className="field-label">
          Resume (PDF)<span className="ml-0.5 text-red-600">*</span>
        </label>
        <input
          id="resume"
          name="resume"
          type="file"
          accept="application/pdf,.pdf"
          ref={fileInputRef}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          aria-invalid={Boolean(fieldErrors.resume?.length)}
          className="field-input file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        />
        {fieldErrors.resume?.length ? (
          <p className="field-error">{fieldErrors.resume.join(' ')}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            PDF only, up to {formatMegabytes(maxResumeBytes)}.
            {fileName ? ` Selected: ${fileName}` : ''}
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
          placeholder="Why you are a good fit for this role."
          className="field-input"
        />
        {fieldErrors.coverNote?.length ? (
          <p className="field-error">{fieldErrors.coverNote.join(' ')}</p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">{coverNote.length}/2000 characters.</p>
        )}
      </div>

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
