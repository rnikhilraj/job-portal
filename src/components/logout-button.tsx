'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiFetch } from '@/lib/http';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={`btn-secondary btn-sm ${className}`}
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
