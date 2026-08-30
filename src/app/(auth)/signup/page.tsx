import Link from 'next/link';

import { SignupForm } from './signup-form';

export const metadata = { title: 'Sign up' };

export default function SignupPage() {
  return (
    /* Signup stays a single centred card; only login runs the two-column split. */
    <div className="card enter-1 mx-auto w-full max-w-md">
      <h1 className="font-display text-display-sm font-semibold">Create a candidate account</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        Takes about thirty seconds. Hiring-team accounts are set up by an administrator, not
        here.
      </p>

      <SignupForm />

      <p className="mt-6 border-t border-mist-200 pt-5 text-sm text-ink-muted">
        Been here before?{' '}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </div>
  );
}
