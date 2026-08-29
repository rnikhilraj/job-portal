import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';
import { SAMPLE_EMPLOYERS, SAMPLE_JOBS } from '@/modules/jobs/job.samples';

/**
 * The demo dataset's listings, as a scrollable strip.
 *
 * Deliberately NOT a "trusted by" wall. Northwind Labs and Aurora Systems are
 * fixtures invented for the seed script, nobody has adopted this product, and a
 * logo wall would be claiming otherwise. So the section says what these are —
 * example postings written into the database on first run — and earns its place
 * by showing the shape of the data rather than by implying scale.
 *
 * It scrolls rather than auto-loops. A marquee here was full-bleed, which broke
 * alignment with every other section on the page and clipped the last card at
 * the viewport edge; it also made a card readable only while it happened to be
 * passing. Scrolling keeps the strip inside the same max-width and padding as
 * the heading above it, puts every card within reach at every width, and needs
 * no motion at all — so there is nothing for prefers-reduced-motion to undo.
 *
 * The strip is focusable on purpose: a region that scrolls must be operable
 * from the keyboard, or its content is unreachable without a pointer.
 */
function PostingCard({ job }: { job: (typeof SAMPLE_JOBS)[number] }) {
  const employer = SAMPLE_EMPLOYERS[job.ownerEmail];

  return (
    <li
      className="flex w-64 shrink-0 snap-start flex-col justify-between rounded-card
        border border-mist-300 bg-white p-4 shadow-card sm:w-72"
    >
      <div>
        <p className="font-display text-sm font-semibold leading-snug tracking-[-0.01em] text-ink">
          {job.title}
        </p>
        <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.08em] text-petrol-700">
          {employer.org}
        </p>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
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
  );
}

export function ExamplePostings() {
  return (
    <section className="border-y border-mist-300 bg-mist-50 py-12 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">What is in the demo dataset</p>
        <h2 className="section-title mt-2">
          Six example postings, written on first run
        </h2>
        <p className="page-lede">
          These are fixtures, not customers — the seed script creates them so there is something
          real to search, apply to and move through the pipeline the moment you sign in.
        </p>
      </div>

      {/*
        Inside the same container as the heading, so the first card starts on
        the page's left margin and the strip clips at its right one — the cards
        scroll under the margins rather than past the viewport edge.
      */}
      <div className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div
          className="scroll-strip snap-x snap-proximity"
          role="region"
          aria-label="Example postings from the demo dataset"
          tabIndex={0}
        >
          <ul className="flex items-stretch gap-4">
            {SAMPLE_JOBS.map((job) => (
              <PostingCard key={job.title} job={job} />
            ))}
          </ul>
        </div>
      </div>

    </section>
  );
}
