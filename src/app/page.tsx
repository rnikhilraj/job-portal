import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/session';

const CANDIDATE_POINTS = [
  'Search openings by keyword, location and job type',
  'Apply with a PDF resume and an optional cover note',
  'Follow every application through the pipeline',
  'Choose whether recruiters can find your profile',
];

const HR_POINTS = [
  'Post, edit and close your own listings',
  'Review applicants with their resume and cover note',
  'Move candidates from applied to shortlisted',
  'Search candidates who have opted in to being found',
];

/** Signed-in users go straight to their role's home; everyone else sees the pitch. */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === 'HR' ? '/hr/jobs' : '/jobs');
  }

  return (
    <main>
      <section className="border-b border-mist-300 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Hiring, tracked end to end</p>
            <h1 className="mt-3 font-display text-display-lg font-semibold text-ink sm:text-[3.25rem]">
              Every application, at the stage it&rsquo;s actually in.
            </h1>
            <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-muted">
              A hiring tracker for both sides of the table. Candidates apply and see exactly where
              they stand. Recruiters post roles and move people through review without losing the
              thread.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="btn-primary">
                Create a candidate account
              </Link>
              <Link href="/login" className="btn-secondary">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          {[
            { title: 'For candidates', points: CANDIDATE_POINTS, glyph: '◍' },
            { title: 'For hiring teams', points: HR_POINTS, glyph: '◈' },
          ].map((column) => (
            <div key={column.title} className="card">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full
                    bg-petrol-50 text-petrol-700"
                >
                  {column.glyph}
                </span>
                <h2 className="section-title">{column.title}</h2>
              </div>

              <ul className="mt-5 space-y-3">
                {column.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <span aria-hidden="true" className="mt-0.5 text-petrol-500">
                      ✓
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
