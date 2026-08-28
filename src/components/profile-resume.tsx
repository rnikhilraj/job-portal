'use client';

import { useRef, useState } from 'react';

import { Alert } from '@/components/alert';
import { ApiRequestError, apiFetch } from '@/lib/http';
import type { PublicUser, ResumeSummary } from '@/modules/users/user.constants';

const PDF_CONTENT_TYPE = 'application/pdf';

function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / (1024 * 1024))} MB`;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The general profile resume, managed independently of any job application.
 *
 * Rendered as its own card next to the visibility toggle, because the two are
 * one decision from the candidate's point of view: uploading a resume does
 * nothing on its own, and the copy here says so explicitly.
 */
export function ProfileResume({
  resume: initialResume,
  maxResumeBytes,
  isSearchable,
}: {
  resume: ResumeSummary | null;
  maxResumeBytes: number;
  isSearchable: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resume, setResume] = useState<ResumeSummary | null>(initialResume);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a PDF to upload.');
      return;
    }
    // Mirrors the server, which re-checks the type and reads the actual bytes.
    if (file.type !== PDF_CONTENT_TYPE) {
      setError('Only PDF resumes are accepted.');
      return;
    }
    if (file.size > maxResumeBytes) {
      setError(`Resume must be ${formatMegabytes(maxResumeBytes)} or smaller.`);
      return;
    }

    const body = new FormData();
    body.set('resume', file);

    setIsBusy(true);
    try {
      const updated = await apiFetch<PublicUser>('/api/users/me/resume', { method: 'PUT', body });
      setResume(updated.resume);
      setNotice('Resume uploaded.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'Could not reach the server — your resume was not uploaded. Try again in a moment.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove your uploaded resume? Recruiters will no longer be able to download it.')) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      const updated = await apiFetch<PublicUser>('/api/users/me/resume', { method: 'DELETE' });
      setResume(updated.resume);
      setNotice('Resume removed.');
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'Could not reach the server — your resume is still in place. Try again in a moment.',
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">Your resume</h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">
        A general resume for your profile, separate from the one you attach when applying to a
        specific job.
      </p>

      <div className="mt-4 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {resume ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-mist-300 bg-mist-100 px-3.5 py-3">
            <p className="min-w-0 break-words text-sm text-ink-soft">
              <a
                href="/api/users/me/resume"
                className="link"
              >
                {resume.originalName}
              </a>
              <span className="ml-2 text-xs text-ink-faint">{formatSize(resume.sizeBytes)}</span>
            </p>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isBusy}
              className="btn-danger btn-sm"
            >
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">You have not uploaded a resume yet.</p>
        )}

        {/*
          Stated on both sides of the toggle so the tradeoff is unmissable: the
          upload alone changes nothing, and the opt-in alone shares nothing.
        */}
        <p
          className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm leading-relaxed ${
            isSearchable
              ? 'border-status-reviewed/25 bg-status-reviewed-tint text-status-reviewed'
              : 'border-mist-300 bg-mist-100 text-ink-soft'
          }`}
        >
          <span aria-hidden="true" className="mt-px shrink-0 font-semibold">
            {isSearchable ? '!' : '🔒'}
          </span>
          <span>
          {isSearchable ? (
            <>
              <strong className="font-medium">Recruiters can download this resume.</strong> Your
              profile is visible to recruiters, so any HR user can find you and download the file
              above along with your email and phone number. Turn off recruiter visibility to stop
              that immediately.
            </>
          ) : (
            <>
              <strong className="font-medium">This resume is private right now.</strong> Only you
              can download it. It becomes visible to recruiters — along with your email and phone
              number — only if you turn on{' '}
              <em>Make my profile visible to recruiters</em> below.
            </>
          )}
          </span>
        </p>

        <form onSubmit={handleUpload} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="profileResume" className="field-label">
              {resume ? 'Replace resume' : 'Upload resume'}
            </label>
            <input
              id="profileResume"
              name="resume"
              type="file"
              accept="application/pdf,.pdf"
              ref={fileInputRef}
              className="field-input py-2.5 file:mr-3 file:rounded file:border-0 file:bg-mist-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-soft"
            />
            <p className="field-hint">PDF only, up to {formatMegabytes(maxResumeBytes)}.</p>
          </div>
          <button type="submit" className="btn-primary shrink-0" disabled={isBusy}>
            {isBusy ? 'Working…' : resume ? 'Replace' : 'Upload'}
          </button>
        </form>
      </div>
    </section>
  );
}
