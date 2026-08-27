import Link from 'next/link';

import { SignupForm } from './signup-form';

export const metadata = { title: 'Sign up · Job Application Tracker' };

export default function SignupPage() {
  return (
    <div className="card">
      <h1 className="text-xl font-semibold">Create a candidate account</h1>
      <p className="mt-1 text-sm text-slate-600">
        HR accounts are provisioned by an administrator and cannot be created here.
      </p>

      <SignupForm />

      <p className="mt-6 text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
