'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiRequestError, apiFetch } from '@/lib/http';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setIsPending(true);
    setError(null);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch (caught) {
      // Clearing the cookie is the server's job, so a failure here means the
      // session is still live. Saying so beats a button that silently does
      // nothing and leaves the user believing they signed out.
      setError(
        caught instanceof ApiRequestError
          ? `${caught.message} You are still signed in.`
          : 'Could not reach the server — you are still signed in.',
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className={`btn-secondary btn-sm ${className}`}
      >
        {isPending ? 'Logging out\u2026' : 'Log out'}
      </button>
      {error ? (
        <span role="alert" className="mt-1.5 text-xs font-medium text-status-rejected">
          {error}
        </span>
      ) : null}
    </span>
  );
}
