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
      setError('Pick a file first.');
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
      setNotice('Uploaded. That\u2019s the one recruiters will see.');
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
    if (
      !window.confirm(
        'Remove your resume? Recruiters will no longer be able to download it.',
      )
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      const updated = await apiFetch<PublicUser>('/api/users/me/resume', { method: 'DELETE' });
      setResume(updated.resume);
      setNotice('Removed. Nothing to download now.');
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
        Your default CV. Separate from the one you attach to a specific application, so you can
        keep a good general version here and tailor the rest.
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
          <p className="text-sm text-ink-muted">Nothing uploaded yet.</p>
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
              <strong className="font-medium">Recruiters can download this.</strong> Your
              profile is visible, so any HR user can find you and take this file along with your
              email and phone number. Switching visibility off stops that the moment you save.
            </>
          ) : (
            <>
              <strong className="font-medium">This is private right now.</strong> Only you can
              download it. It reaches recruiters — along with your email and phone number — only
              if you switch on <em>Make my profile visible to recruiters</em> below.
            </>
          )}
          </span>
        </p>

        <form onSubmit={handleUpload}>
          <label htmlFor="profileResume" className="field-label">
            {resume ? 'Replace resume' : 'Upload resume'}
          </label>

          {/*
            Input and button are the only children of the flex row, and the hint
            sits outside it. Keeping the hint inside would make the row's
            bottom edge the bottom of the hint text, which pushed the button
            below the input instead of level with it.

            Default `items-stretch` then makes the two exactly equal in height —
            both carry min-h-11 — so they read as one control rather than two
            adjacent ones.
          */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="profileResume"
              name="resume"
              type="file"
              accept="application/pdf,.pdf"
              ref={fileInputRef}
              aria-describedby="profileResume-hint"
              className="field-input min-w-0 flex-1 file:mr-3 file:rounded file:border-0
                file:bg-mist-200 file:px-3 file:py-1.5 file:text-sm file:font-medium
                file:text-ink-soft"
            />
            <button type="submit" className="btn-primary shrink-0" disabled={isBusy}>
              {isBusy ? 'Uploading…' : resume ? 'Swap it out' : 'Upload'}
            </button>
          </div>

          <p id="profileResume-hint" className="field-hint">
            PDF only, up to {formatMegabytes(maxResumeBytes)}.
          </p>
        </form>
      </div>
    </section>
  );
}
