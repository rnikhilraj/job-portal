'use client';

import { useState, useSyncExternalStore } from 'react';

import { APPLICATION_STATUS_LABELS } from '@/modules/applications/application.constants';
import { StatusChip } from '@/components/pipeline';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';
import { FEATURED_SAMPLE_JOB, SAMPLE_EMPLOYERS } from '@/modules/jobs/job.samples';
import { fromLocalDay, localToday } from '@/lib/local-day';

/**
 * The landing hero: one application on the product's real status rail.
 *
 * It opens at Applied and stays there. **Nothing plays on its own** — no
 * autoplay, no travel, no timers, no scheduled anything. The only way this card
 * ever moves is that somebody presses a stage, which is the whole difference
 * between a demo that performs at you and one that answers when asked.
 *
 * Pressing Reviewed or Shortlisted moves the card and fills the rail to that
 * station. That transition is deliberate motion in response to a click, not
 * decoration: it shows *which way* the rail travelled, which a hard cut cannot.
 * The app-wide reduced-motion rule collapses it to nothing for anyone who has
 * asked for that, so the click still lands — it just arrives instantly.
 */
const STAGES = ['APPLIED', 'REVIEWED', 'SHORTLISTED'] as const;
type Stage = (typeof STAGES)[number];

/**
 * The card occupies 62% of the lane, so its travel per station, expressed as a
 * share of its own width, is (100 / 0.62 - 100) / 2. As a percentage of the
 * card the same number is correct at 360px and at 1440px.
 */
const CARD_SHARE = 0.62;
const TRAVEL_PER_STAGE = (100 / CARD_SHARE - 100) / (STAGES.length - 1);

/** The stage the card opens at. Applied is where a visitor actually stands. */
const RESTING_STAGE: Stage = 'APPLIED';

const BLURB: Record<Stage, string> = {
  APPLIED: 'Your application is in. The clock starts here.',
  REVIEWED: 'Someone has actually opened it — no more guessing.',
  SHORTLISTED: 'You are through to the next round.',
};

/** The listing the demo application is against — a real row from the seed data. */
const DEMO_JOB = FEATURED_SAMPLE_JOB;
const DEMO_EMPLOYER = SAMPLE_EMPLOYERS[DEMO_JOB.ownerEmail];

/**
 * Days each stage sits behind the latest one, keeping the spacing of the
 * original 12 → 14 → 18 Mar example: two days to be read, four more to be
 * shortlisted. The most recent stage is always today, so the trail runs
 * backwards into the past and never advertises a future date.
 */
const DAYS_FROM_APPLIED = [0, 2, 6] as const;

/**
 * The stamps are formatted with a FIXED locale, unlike the rest of the app.
 *
 * Everywhere else `undefined` is right: the value is server data and the server
 * formats it once. Here the date is recomputed in the browser, so the same day
 * has to render byte-identically on both sides of hydration or React reports a
 * mismatch — and locale is the other half of that, not just timezone. en-GB
 * also gives the day-then-month order the original example used.
 */
function formatStamp(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** The day never changes under us, so there is nothing to subscribe to. */
const NEVER_CHANGES = () => () => {};

export function PipelineHero({ serverDay }: { serverDay: string }) {
  /* Opens at the resting stage; only a press ever changes it. */
  const [active, setActive] = useState<Stage>(RESTING_STAGE);

  /**
   * The day the receipt is dated from.
   *
   * This is the one value that is legitimately different on the server and in
   * the browser, which is exactly what useSyncExternalStore exists for: React
   * renders the server's day through hydration, then re-renders with the
   * viewer's own. Computing it during render instead would put the container's
   * timezone in the markup and the browser's in the hydration pass — which is
   * how a page ends up showing yesterday to everyone east of the server.
   *
   * The store never emits, so subscribe is a no-op teardown: the day is read
   * once after mount and does not chase midnight.
   */
  const day = useSyncExternalStore(NEVER_CHANGES, localToday, () => serverDay);

  const reachedIndex = STAGES.indexOf(active);

  /**
   * Stamps run backwards from the stage reached: the latest is today and the
   * earlier ones are spaced behind it, so the receipt reads as a history rather
   * than as one date printed three times.
   */
  const stampFor = (index: number): string => {
    const daysAgo = DAYS_FROM_APPLIED[reachedIndex]! - DAYS_FROM_APPLIED[index]!;
    const date = fromLocalDay(day);
    date.setDate(date.getDate() - daysAgo);
    return formatStamp(date);
  };

  return (
    <div className="w-full">
      <div className="panel-feature relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
        {/* Below sm the card fills the width; from sm up it sits over the first station. */}
        <div className="relative">
          <div
            style={{ '--travel': `${reachedIndex * TRAVEL_PER_STAGE}%` } as React.CSSProperties}
            className="w-full transform-none transition-transform duration-500
              ease-[cubic-bezier(0.22,0.68,0.36,1)]
              sm:w-[62%] sm:[transform:translateX(var(--travel))]"
          >
            <div className="rounded-card border border-mist-300 bg-white p-4 shadow-card">
              <p className="font-display text-sm font-semibold leading-snug text-ink">
                {DEMO_JOB.title}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {DEMO_EMPLOYER.org} · {DEMO_JOB.location}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* Keyed so the chip cross-fades on a change rather than snapping. */}
                <StatusChip key={active} status={active} size="sm" />
                <span className="text-xs text-ink-faint">{JOB_TYPE_LABELS[DEMO_JOB.jobType]}</span>
              </div>
            </div>

            {/* The tether: the card is visibly attached to the rail it sits on. */}
            <div aria-hidden="true" className="mx-auto h-4 w-px bg-mist-400" />
          </div>
        </div>

        {/* Track. At Applied the fill has no distance to cover, so none is drawn. */}
        <div className="relative mt-1 h-1 rounded-full bg-mist-300">
          <div
            style={{ transform: `scaleX(${reachedIndex / (STAGES.length - 1)})` }}
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-petrol-500
              transition-transform duration-500 ease-[cubic-bezier(0.22,0.68,0.36,1)]"
          />
        </div>

        {/*
          Stations, as real buttons. Each one is a 24px dot, so the accessible
          name carries the whole instruction — "Show the Reviewed stage" — and
          aria-pressed reports which is currently showing. The text label under
          each dot stays outside the button so it reads as a rail label rather
          than being announced twice.
        */}
        <ol className="relative -mt-3 flex items-start justify-between">
          {STAGES.map((stage, index) => {
            const reached = index <= reachedIndex;

            return (
              <li key={stage} className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActive(stage)}
                  aria-pressed={active === stage}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2
                    text-[0.625rem] font-bold leading-none transition-all duration-300
                    ${
                      reached
                        ? 'border-petrol-600 bg-petrol-600 text-white'
                        : 'border-mist-400 bg-white text-transparent'
                    }
                    ${index === reachedIndex ? 'scale-110 ring-4 ring-petrol-200' : 'scale-100'}`}
                >
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">Show the {APPLICATION_STATUS_LABELS[stage]} stage</span>
                </button>
                <span
                  className={`text-xs font-medium ${reached ? 'text-ink' : 'text-ink-faint'}`}
                >
                  {APPLICATION_STATUS_LABELS[stage]}
                </span>
              </li>
            );
          })}
        </ol>

        {/* The receipt: one stamp per station reached. */}
        <ol
          className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-mist-300
            pt-4 text-xs text-ink-muted"
        >
          {STAGES.slice(0, reachedIndex + 1).map((stage, index) => (
            <li key={stage}>
              <span className="font-medium text-ink-soft">
                {APPLICATION_STATUS_LABELS[stage]}
              </span>{' '}
              {stampFor(index)}
            </li>
          ))}
        </ol>

        {/*
          The stage in words. The rail says where the card is; this says what
          that means, which is the part a diagram alone cannot give.
        */}
        <p
          key={active}
          className="rise-in mt-6 max-w-sm text-sm leading-relaxed text-ink-soft"
          /* Every change here is user-driven, so announcing it is an answer, not chatter. */
          aria-live="polite"
        >
          {BLURB[active]}
        </p>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        This is the real status rail from the product, against a listing from the demo dataset.
        Press a stage to see it there.
      </p>
    </div>
  );
}
