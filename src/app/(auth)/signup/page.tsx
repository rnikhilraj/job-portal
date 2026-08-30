import Link from 'next/link';

import { SignupForm } from './signup-form';

export const metadata = { title: 'Sign up' };

/**
 * What a candidate account actually grants — checked against the code, not
 * assumed. Each application carries its own uploaded PDF (`ApplyForm` requires
 * one every time), so nothing here promises a resume kept on file and attached
 * for you: that feature does not exist.
 */
const ACCOUNT_POINTS = [
  'Apply with a PDF resume and an optional cover note. One application per role, so nothing goes twice.',
  'Each one keeps its own rail, and moves along it the moment a hiring team moves it.',
  'A profile with your headline and skills. Hiring teams can find it only if you switch that on — it is off until you do.',
];

export default function SignupPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-center lg:gap-16">
      {/* Form first in the DOM, right-hand column at desktop — see login/page.tsx. */}
      <div className="enter-1 mx-auto w-full max-w-md lg:order-last lg:max-w-none">
        <div className="card">
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
      </div>

      {/* Unpanelled for the same reason as login: the form is the raised surface. */}
      <aside className="enter-2 hidden lg:block">
        <p className="eyebrow">What an account gets you</p>
        <h2 className="mt-3 font-display text-display-md font-semibold text-ink">
          Your side of the hiring desk.
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
          Three fields to sign up. What it opens is a profile you control and a record of every
          application you send.
        </p>

        <ul className="mt-7 space-y-3">
          {ACCOUNT_POINTS.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft"
            >
              <span aria-hidden="true" className="mt-0.5 text-petrol-500">
                ✓
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
