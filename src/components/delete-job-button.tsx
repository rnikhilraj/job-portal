'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiFetch } from '@/lib/http';

/**
 * Deleting a listing also removes its applications and resume files, so the
 * confirmation spells that out rather than asking a bare "are you sure?".
 */
export function DeleteJobButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete “${jobTitle}”?\n\nThis also permanently removes every application to this listing and the uploaded resumes.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setError('Could not delete this listing.');
      setIsDeleting(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={handleDelete} disabled={isDeleting} className="btn-danger">
        {isDeleting ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
