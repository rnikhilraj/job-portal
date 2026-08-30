import Link from 'next/link';
import { Fragment, Suspense } from 'react';

import { StatusChip } from '@/components/pipeline';
import type { ApplicationStatus } from '@/modules/applications/application.constants';

import { LoginForm } from './login-form';

export const metadata = { title: 'Log in' };

/**
 * The three forward stages, in the order an application travels them. Read off
 * the product's own rail rather than retyped as marketing copy, so the promise
 * beside the form cannot drift from the thing it describes.
 */
const FORWARD_STAGES: ApplicationStatus[] = ['APPLIED', 'REVIEWED', 'SHORTLISTED'];

export default function LoginPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-center lg:gap-16">
      {/*
       * The form is FIRST in the DOM, so the page announces "Log in" before its
       * supporting copy and the h1 is not preceded by an h2. `lg:order-last`
       * moves it to the right-hand column visually. The aside holds nothing
       * focusable, so reordering it cannot desynchronise the tab order from
       * what is on screen — the usual cost of CSS order is not paid here.
       */}
      <div className="enter-1 mx-auto w-full max-w-md lg:order-last lg:max-w-none">
        <div className="card">
          <h1 className="font-display text-display-sm font-semibold">Log in</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            Candidates and hiring teams both start here.
          </p>

          <Suspense fallback={<p className="mt-6 text-sm text-ink-muted">Loading…</p>}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 border-t border-mist-200 pt-5 text-sm text-ink-muted">
            First time here?{' '}
            <Link href="/signup" className="link">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/*
       * Deliberately not a `.panel-feature` and deliberately not a card: the
       * white form is the one raised surface on this page, and a second panel
       * beside it would split the focus rather than share it.
       */}
      <aside className="enter-2 hidden lg:block">
        <p className="eyebrow">Where your applications live</p>
        <h2 className="mt-3 font-display text-display-md font-semibold text-ink">
          Know where you stand.
        </h2>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
          Every application you send keeps its own rail, and moves along it the moment a
          hiring team moves it — so the answer to “did anyone read it?” is on the screen
          rather than in your inbox.
        </p>

        <div className="mt-7 flex items-center gap-2">
          {FORWARD_STAGES.map((stage, index) => (
            <Fragment key={stage}>
              {index > 0 ? (
                <span aria-hidden="true" className="h-px w-5 flex-none bg-mist-400" />
              ) : null}
              <StatusChip status={stage} size="sm" />
            </Fragment>
          ))}
        </div>

        <p className="mt-7 border-t border-mist-300 pt-5 text-sm leading-relaxed text-ink-muted">
          Hiring teams can find you in the candidate directory only if you switch it on. It is
          off until you do.
        </p>
      </aside>
    </div>
  );
}
