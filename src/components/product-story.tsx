import Link from 'next/link';

import { StatusChip } from '@/components/pipeline';
import { Reveal } from '@/components/reveal';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';
import { SAMPLE_EMPLOYERS, SAMPLE_JOBS } from '@/modules/jobs/job.samples';

/**
 * The scroll story: search → apply → track → shortlisted.
 *
 * Every stage shows a fragment of the real interface, built from the same
 * component classes the product ships (`.card`, `.field-input`, `StatusChip`,
 * the pipeline rail) against real rows from the demo dataset. No stock
 * illustration, and no screenshot either — a screenshot goes stale the moment
 * the design moves, whereas these inherit every token change automatically.
 *
 * The fragments are static. They are honest about being a preview rather than
 * pretending to be live: nothing here is focusable or clickable, so a keyboard
 * user is never dropped into a form that does not submit, and the tab order
 * runs straight past them to the real call to action.
 *
 * The story stops at Shortlisted because the product does. There is no "hired"
 * stage in the pipeline, and inventing one on the landing page would be selling
 * something the app cannot deliver.
 */
const SEARCH_RESULTS = SAMPLE_JOBS.filter((job) => job.status !== 'CLOSED').slice(0, 2);

/**
 * Marks a fragment as scenery: out of the a11y tree and out of the tab order.
 *
 * `aria-hidden` alone would leave any focusable child reachable by keyboard but
 * unannounced, which is the worst of both. Nothing in these fragments is a real
 * control today; `inert` keeps that true if one is ever added by accident.
 */
const INERT_FRAGMENT = { 'aria-hidden': true, inert: true } as const;

function SearchDemo() {
  return (
    <div className="card" {...INERT_FRAGMENT}>
      {/* The same three fields the real filter bar carries, at panel scale. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="field-label">Keyword</p>
          <div className="field-input flex items-center gap-2 text-ink">
            <span aria-hidden="true" className="text-petrol-600">
              ⌕
            </span>
            <span>backend</span>
          </div>
        </div>
        <div>
          <p className="field-label">Location</p>
          <div className="field-input text-ink-faint">City, or Remote</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="field-label">Role type</p>
          <div className="field-input flex items-center justify-between gap-2 text-ink">
            <span>Full time</span>
            <span aria-hidden="true" className="text-ink-faint">
              ▾
            </span>
          </div>
        </div>
        <div className="btn-primary pointer-events-none">Search</div>
      </div>

      <ul className="mt-4 space-y-3">
        {SEARCH_RESULTS.map((job) => (
          <li key={job.title} className="rounded-card border border-mist-300 bg-white p-3.5">
            <p className="font-display text-sm font-semibold text-ink">{job.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">◎</span>
                {job.location}
              </span>
              <span aria-hidden="true" className="text-mist-400">
                ·
              </span>
              <span>{JOB_TYPE_LABELS[job.jobType]}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ApplyDemo() {
  return (
    <div className="card" {...INERT_FRAGMENT}>
      <p className="field-label">Resume (PDF)</p>
      <div
        className="flex items-center justify-between gap-3 rounded-md border border-mist-300
          bg-mist-50 px-3 py-2.5"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
          <span aria-hidden="true" className="text-petrol-600">
            ⎙
          </span>
          <span className="truncate">asha-nair-cv.pdf</span>
        </span>
        <span className="shrink-0 text-xs text-ink-faint">84 KB</span>
      </div>

      <p className="field-label mt-4">Cover note (optional)</p>
      <div className="field-input min-h-[4.5rem] text-ink-muted">
        Six years on payments infrastructure, most recently owning the ledger service…
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="btn-primary pointer-events-none">Submit application</div>
        <p className="text-xs text-ink-faint">One application per listing.</p>
      </div>
    </div>
  );
}

function TrackDemo() {
  return (
    <div className="card" {...INERT_FRAGMENT}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-ink">
          {SAMPLE_JOBS[1]?.title ?? 'Frontend Engineer (React)'}
        </p>
        <StatusChip status="REVIEWED" size="sm" />
      </div>

      {/* The rail, drawn at its Reviewed position — the same geometry as the real one. */}
      <div className="mt-6">
        <div className="relative h-1 rounded-full bg-mist-300">
          <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-petrol-500" />
        </div>
        <ol className="relative -mt-3 flex items-start justify-between">
          {[
            { label: 'Applied', reached: true, glyph: '○' },
            { label: 'Reviewed', reached: true, glyph: '◍' },
            { label: 'Shortlisted', reached: false, glyph: '✓' },
          ].map((station) => (
            <li key={station.label} className="flex flex-col items-center gap-2.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2
                  text-[0.625rem] font-bold leading-none ${
                    station.reached
                      ? 'border-petrol-600 bg-petrol-600 text-white'
                      : 'border-mist-400 bg-white text-transparent'
                  }`}
              >
                <span aria-hidden="true">{station.glyph}</span>
              </span>
              <span
                className={`text-xs font-medium ${station.reached ? 'text-ink' : 'text-ink-faint'}`}
              >
                {station.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ShortlistedDemo() {
  const employer = SAMPLE_EMPLOYERS['hr1@example.com'];

  return (
    <div className="card" {...INERT_FRAGMENT}>
      <p className="eyebrow">The recruiter&rsquo;s side</p>

      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card
          border border-mist-300 bg-white p-3.5"
      >
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-ink">Asha Nair</p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            Backend engineer focused on distributed systems
          </p>
        </div>
        <StatusChip status="SHORTLISTED" size="sm" />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        {employer.org} moved Asha to Shortlisted, and her rail advanced the next time she looked.
        That is where this pipeline ends — the conversation continues off the platform, and the
        product does not pretend otherwise.
      </p>
    </div>
  );
}

const STAGES = [
  {
    number: '01',
    title: 'Search',
    copy: 'Filter open roles by keyword, location and type. The filters live in the URL, so a search you like is a link you can send.',
    demo: <SearchDemo />,
  },
  {
    number: '02',
    title: 'Apply',
    copy: 'One PDF resume, one optional cover note, one application per listing. The form tells you immediately if something is wrong with the file.',
    demo: <ApplyDemo />,
  },
  {
    number: '03',
    title: 'Track',
    copy: 'Every application carries its own rail. When a recruiter opens yours, the position moves, so silence and progress stop looking the same.',
    demo: <TrackDemo />,
  },
  {
    number: '04',
    title: 'Shortlisted',
    copy: 'The last stage the pipeline models. Recruiters move candidates forward from their side; you see the result from yours.',
    demo: <ShortlistedDemo />,
  },
];

export function ProductStory() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <Reveal>
        <p className="eyebrow">End to end</p>
        <h2 className="section-title mt-2">Four stages, and none of them invented</h2>
        <p className="page-lede">
          Each panel below is built from the product&rsquo;s own interface, against rows that exist
          in the demo dataset.
        </p>
      </Reveal>

      <ol className="mt-10 space-y-12 sm:space-y-16">
        {STAGES.map((stage, index) => (
          <li key={stage.title}>
            <Reveal>
              <div
                className={`grid items-center gap-6 lg:grid-cols-2 lg:gap-12 ${
                  // Alternating sides on wide screens; a single column below that,
                  // where the demo always follows the words it illustrates.
                  index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <div className="flex items-baseline gap-3">
                    <span
                      aria-hidden="true"
                      className="font-display text-display-sm font-semibold text-petrol-300"
                    >
                      {stage.number}
                    </span>
                    <h3 className="section-title">{stage.title}</h3>
                  </div>
                  <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
                    {stage.copy}
                  </p>
                </div>

                {stage.demo}
              </div>
            </Reveal>
          </li>
        ))}
      </ol>

      <Reveal delayMs={90}>
        <div className="mt-14 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link href="/signup" className="btn-primary">
            Create a candidate account
          </Link>
          <Link href="/login" className="btn-secondary">
            Log in
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
