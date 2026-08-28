import Link from 'next/link';

import { SignupForm } from './signup-form';

export const metadata = { title: 'Sign up' };

export default function SignupPage() {
  return (
    <div className="card">
      <h1 className="font-display text-display-sm font-semibold">Create a candidate account</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        HR accounts are provisioned by an administrator and cannot be created here.
      </p>

      <SignupForm />

      <p className="mt-6 border-t border-mist-200 pt-5 text-sm text-ink-muted">
        Already registered?{' '}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </div>
  );
}
