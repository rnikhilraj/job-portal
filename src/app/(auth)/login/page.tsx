import Link from 'next/link';
import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata = { title: 'Log in · Job Application Tracker' };

export default function LoginPage() {
  return (
    <div className="card">
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-slate-600">
        HR and candidate accounts both sign in here.
      </p>

      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Loading…</p>}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-sm text-slate-600">
        No candidate account yet?{' '}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
