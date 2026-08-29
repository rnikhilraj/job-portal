import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ExamplePostings } from '@/components/example-postings';
import { PipelineHero } from '@/components/pipeline-hero';
import { ProductStory } from '@/components/product-story';
import { Reveal } from '@/components/reveal';
import { localToday } from '@/lib/local-day';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/modules/applications/application.constants';
import { getCurrentUser } from '@/modules/auth/session';

/*
 * What each side actually gets, stated as guarantees rather than features. A
 * bullet earns its place here only if it names something this product does that
 * a reader could not assume — "search jobs" is table stakes and says nothing.
 *
 * Terminology follows the rule in CLAUDE.md: a *role* is the work; a *listing*
 * is the published record advertising it. Candidates apply to roles, hiring
 * teams own listings.
 */
const CANDIDATE_POINTS = [
  'Filter open roles by keyword, location and type, then share the filtered link.',
  'One application per role, with a PDF resume and an optional cover note.',
  'Every application keeps its own rail, and moves when a recruiter moves it.',
  'Recruiters can find you only if you switch it on. It is off until you do.',
];

const HR_POINTS = [
  'Close a listing without deleting it. Closed ones keep their applicants.',
  'Every applicant arrives with their resume and cover note attached.',
  'Move people from applied to shortlisted, and they see it from their side.',
  'Only candidates who opted in appear in the directory, however well others match.',
];

/**
 * The three stages an application moves through, read off the same labels the
 * pipeline rail uses rather than retyped as marketing copy.
 */
const FORWARD_STAGES: ApplicationStatus[] = ['APPLIED', 'REVIEWED', 'SHORTLISTED'];
const FORWARD_STAGE_LABELS = FORWARD_STAGES.map(
  (stage) => `${APPLICATION_STATUS_LABELS[stage]}.`,
).join(' ');

/** Signed-in users go straight to their role's home; everyone else sees the pitch. */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === 'HR' ? '/hr/jobs' : '/jobs');
  }

  return (
    <main>
      <section className="border-b border-mist-300 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-16">
            <div className="rise-in">
              {/*
                The eyebrow is the product's real stage labels, not a slogan
                about them — so if a stage is ever renamed, the headline above
                the hero cannot go on advertising one that no longer exists.
              */}
              <p className="eyebrow">{FORWARD_STAGE_LABELS}</p>
              <h1 className="mt-3 font-display text-display-lg font-semibold text-ink sm:text-[3.25rem]">
                Silence isn&rsquo;t a status.
              </h1>
              {/*
                The headline is the hook and the eyebrow names the stages, so
                the lede does neither again: its only job is to say plainly what
                the thing is and who does what.
              */}
              <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-muted">
                A hiring platform where every application carries a live status. Recruiters move
                people forward from their side, and candidates watch it happen from theirs.
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

            {/*
              The signature moment, and the page's only one. Not a screenshot or
              an illustration — the product's real status rail, with a real
              listing riding it, playable, so the core interaction is the first
              thing a visitor touches.
            */}
            <div className="rise-in [animation-delay:120ms]">
              <PipelineHero serverDay={localToday()} />
            </div>
          </div>
        </div>
      </section>

      <ExamplePostings />

      <ProductStory />

      <section className="border-t border-mist-300 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <h2 className="section-title">Two sides of the same pipeline</h2>
            <p className="page-lede">
              The same three stages, read from whichever end you are standing at.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {[
              { title: 'For candidates', points: CANDIDATE_POINTS, glyph: '◍' },
              { title: 'For hiring teams', points: HR_POINTS, glyph: '◈' },
            ].map((column, index) => (
              <Reveal key={column.title} delayMs={index * 90}>
                <div className="card h-full">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 items-center justify-center rounded-full
                        bg-petrol-50 text-petrol-700"
                    >
                      {column.glyph}
                    </span>
                    <h3 className="section-title">{column.title}</h3>
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
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
