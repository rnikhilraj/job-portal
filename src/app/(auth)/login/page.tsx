import Link from 'next/link';
import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <div className="card">
      <h1 className="font-display text-display-sm font-semibold">Log in</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        HR and candidate accounts both sign in here.
      </p>

      <Suspense fallback={<p className="mt-6 text-sm text-ink-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 border-t border-mist-200 pt-5 text-sm text-ink-muted">
        No candidate account yet?{' '}
        <Link href="/signup" className="link">
          Sign up
        </Link>
      </p>
    </div>
  );
}
