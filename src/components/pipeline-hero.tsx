'use client';

import { useEffect, useRef, useState } from 'react';

import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/modules/applications/application.constants';

/**
 * The landing hero: the product's actual status rail, at poster scale, live.
 *
 * This is the one place in the app that gets decoration, and it is deliberately
 * not an illustration — it is the same three-stage model the rest of the
 * product runs on. A visitor can scrub it and feel the transition before they
 * ever sign up, which is the whole pitch in three seconds.
 *
 * It auto-plays once and then holds. Interaction is a reward for curiosity, not
 * a demand, and under prefers-reduced-motion the rail renders fully drawn and
 * still responds to clicks.
 */
const STAGES = ['APPLIED', 'REVIEWED', 'SHORTLISTED'] as const;
type Stage = (typeof STAGES)[number];

const BLURB: Record<ApplicationStatus, string> = {
  APPLIED: 'Your application is in. The clock starts here.',
  REVIEWED: 'Someone has actually opened it — no more guessing.',
  SHORTLISTED: 'You are through to the next round.',
  REJECTED: 'Not this time. The rail stops rather than pretending otherwise.',
};

export function PipelineHero() {
  const [active, setActive] = useState<ApplicationStatus>('APPLIED');
  const [hasPlayed, setHasPlayed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * The opening sequence: each station lights in turn, then it settles on
   * Shortlisted. Skipped entirely for reduced motion, which starts on the
   * finished frame instead.
   */
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /*
     * Both branches go through the same scheduler so neither calls setState
     * synchronously in the effect body — reduced motion simply jumps straight
     * to the finished frame instead of stepping through it.
     */
    const schedule: Array<[delay: number, run: () => void]> = prefersReduced
      ? [
          [
            0,
            () => {
              setActive('SHORTLISTED');
              setHasPlayed(true);
            },
          ],
        ]
      : [
          [1100, () => setActive('REVIEWED')],
          [2100, () => setActive('SHORTLISTED')],
          [2900, () => setHasPlayed(true)],
        ];

    const timers = schedule.map(([delay, run]) => window.setTimeout(run, delay));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const isRejected = active === 'REJECTED';
  const reachedIndex = isRejected ? 0 : STAGES.indexOf(active as Stage);

  return (
    <div ref={containerRef} className="w-full">
      {/*
        The gradient deepens toward Shortlisted, so warmth increases with
        progress. It encodes the journey rather than decorating the box.
      */}
      <div className="panel-feature relative overflow-hidden px-5 py-8 sm:px-10 sm:py-12">
        <div className="relative">
          {/* Track */}
          <div className="relative h-1 rounded-full bg-mist-300">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-petrol-500
                transition-[width] duration-[900ms] ease-[cubic-bezier(0.22,0.68,0.36,1)]"
              style={{
                width: isRejected ? '0%' : `${(reachedIndex / (STAGES.length - 1)) * 100}%`,
              }}
            />
            {/* The filament: one pass on load, then gone. */}
            {!hasPlayed ? (
              <span
                aria-hidden="true"
                className="animate-filament absolute inset-y-0 left-0 w-1/4 rounded-full
                  bg-gradient-to-r from-transparent via-white/80 to-transparent"
              />
            ) : null}
          </div>

          {/* Stations */}
          <ol className="relative -mt-3 flex items-start justify-between">
            {STAGES.map((stage, index) => {
              const reached = !isRejected && index <= reachedIndex;
              const isCurrent = !isRejected && index === reachedIndex;

              return (
                <li key={stage} className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setHasPlayed(true);
                      setActive(stage);
                    }}
                    aria-pressed={active === stage}
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2
                      text-[0.625rem] font-bold leading-none transition-all duration-500
                      ${
                        reached
                          ? 'border-petrol-600 bg-petrol-600 text-white'
                          : 'border-mist-400 bg-white text-transparent'
                      }
                      ${isCurrent ? 'scale-110 ring-4 ring-petrol-200' : 'scale-100'}`}
                  >
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">
                      Show the {APPLICATION_STATUS_LABELS[stage]} stage
                    </span>
                  </button>
                  <span
                    className={`text-xs font-medium transition-colors duration-500 ${
                      reached ? 'text-ink' : 'text-ink-faint'
                    }`}
                  >
                    {APPLICATION_STATUS_LABELS[stage]}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The honest branch. Advancing travels; rejection stops. */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            key={active}
            className="rise-in max-w-sm text-sm leading-relaxed text-ink-soft"
            aria-live="polite"
          >
            {BLURB[active]}
          </p>

          <button
            type="button"
            onClick={() => {
              setHasPlayed(true);
              setActive(isRejected ? 'APPLIED' : 'REJECTED');
            }}
            className="btn-secondary btn-sm self-start sm:self-auto"
          >
            {isRejected ? 'Replay the journey' : 'See a rejection'}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        This is the real status rail from the product. Click a stage to scrub it.
      </p>
    </div>
  );
}
