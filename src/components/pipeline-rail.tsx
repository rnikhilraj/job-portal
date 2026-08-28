'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from '@/modules/applications/application.constants';

/**
 * One application's position in the pipeline, and the product's core emotional
 * moment.
 *
 * The motion is deliberately asymmetric. Advancing sweeps: the fill travels
 * forward and the node settles, because progress should feel like it went
 * somewhere. Rejection does NOT sweep — the rail simply stops and the track
 * ahead drains to a dashed outline. No red flash, no shake. This is the worst
 * news the product delivers, and animating it punitively would be a design
 * failure, not a flourish.
 *
 * State is still encoded in four channels that survive without hue — fill
 * position, glyph, text label and colour — so the animation is decoration on
 * top of an already-readable component, never the thing carrying the meaning.
 */
const FORWARD_STAGES = ['APPLIED', 'REVIEWED', 'SHORTLISTED'] as const;
type ForwardStage = (typeof FORWARD_STAGES)[number];

const STAGE_INDEX: Record<ForwardStage, number> = {
  APPLIED: 0,
  REVIEWED: 1,
  SHORTLISTED: 2,
};

const STATUS_GLYPH: Record<ApplicationStatus, string> = {
  APPLIED: '○',
  REVIEWED: '◍',
  SHORTLISTED: '✓',
  REJECTED: '✕',
};

/** useLayoutEffect warns during SSR; this picks the right hook per environment. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const SEEN_STORAGE_PREFIX = 'jat:seen-status:';

function readSeenStatus(applicationId: string): ApplicationStatus | null {
  try {
    return window.localStorage.getItem(
      SEEN_STORAGE_PREFIX + applicationId,
    ) as ApplicationStatus | null;
  } catch {
    // Private mode, blocked storage, thumbnail capture — never fatal.
    return null;
  }
}

function writeSeenStatus(applicationId: string, status: ApplicationStatus): void {
  try {
    window.localStorage.setItem(SEEN_STORAGE_PREFIX + applicationId, status);
  } catch {
    /* ignore */
  }
}

export function PipelineRail({
  status,
  applicationId,
  className = '',
}: {
  status: ApplicationStatus;
  /**
   * When supplied, the rail remembers the last status this viewer saw and
   * animates the change on the first load after it happened — once. Every load
   * afterwards is calm. Omit it for a static rail.
   */
  applicationId?: string;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState<ApplicationStatus>(status);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  /**
   * Runs before paint, so the previous state is what the browser draws first
   * and the transition to the current one is visible rather than skipped.
   */
  useIsomorphicLayoutEffect(() => {
    if (!applicationId) return;

    const seen = readSeenStatus(applicationId);
    writeSeenStatus(applicationId, status);

    if (!seen || seen === status) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return; // land on the final state, no journey

    setDisplayed(seen);
    setIsAcknowledging(true);

    // Two frames: one to paint the old state, one to start the transition.
    // Both handles are tracked, because cancelling only the outer one leaves
    // the inner frame free to fire setState on an unmounted component if the
    // viewer navigates away inside that ~16ms window.
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => setDisplayed(status));
    });
    const settle = window.setTimeout(() => setIsAcknowledging(false), 1800);

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      window.clearTimeout(settle);
    };
  }, [applicationId, status]);

  const isRejected = displayed === 'REJECTED';
  const reachedIndex = isRejected ? 0 : STAGE_INDEX[displayed as ForwardStage];
  const fillFraction = isRejected ? 0 : reachedIndex / (FORWARD_STAGES.length - 1);

  const description = isRejected
    ? 'Rejected after review'
    : `${APPLICATION_STATUS_LABELS[displayed]} — stage ${reachedIndex + 1} of 3`;

  return (
    <div className={`${className} ${isAcknowledging ? 'animate-acknowledge rounded-md' : ''}`}>
      {/* The text equivalent, and what assistive tech actually reads. */}
      <p className="sr-only" aria-live="polite">
        {description}
      </p>

      <div className="relative" aria-hidden="true">
        {/* Base track. Dashes ahead of a stopped rail rather than staying solid. */}
        <div
          className={`absolute left-2.5 right-2.5 top-2.5 h-0.5 -translate-y-1/2 transition-all duration-500 ${
            isRejected
              ? 'bg-[repeating-linear-gradient(90deg,theme(colors.mist.400)_0_4px,transparent_4px_8px)]'
              : 'bg-mist-300'
          }`}
        />

        {/* The travelling fill. Width, not opacity, so progress reads as movement. */}
        <div
          className="absolute left-2.5 top-2.5 h-0.5 -translate-y-1/2 rounded-full bg-petrol-500
            transition-[width] duration-700 ease-[cubic-bezier(0.22,0.68,0.36,1)]"
          style={{ width: `calc((100% - 1.25rem) * ${fillFraction})` }}
        />

        <ol className="relative flex items-center justify-between">
          {FORWARD_STAGES.map((stage, index) => {
            const reached = !isRejected && index <= reachedIndex;
            const isCurrent = !isRejected && index === reachedIndex;

            return (
              <li key={stage}>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border
                    text-[0.625rem] font-semibold leading-none
                    transition-all duration-500 ease-[cubic-bezier(0.22,0.68,0.36,1)]
                    ${
                      isRejected && index === 0
                        ? 'border-status-rejected bg-status-rejected text-white'
                        : reached
                          ? 'border-petrol-600 bg-petrol-600 text-white'
                          : 'border-mist-400 bg-white text-transparent'
                    }
                    ${isCurrent ? 'scale-110 ring-2 ring-petrol-200' : 'scale-100'}`}
                >
                  {isRejected && index === 0 ? STATUS_GLYPH.REJECTED : '✓'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-1.5 flex justify-between text-[0.6875rem]" aria-hidden="true">
        {FORWARD_STAGES.map((stage, index) => (
          <span
            key={stage}
            className={`transition-colors duration-500 ${
              !isRejected && index === reachedIndex
                ? 'font-semibold text-ink-soft'
                : 'text-ink-faint'
            }`}
          >
            {APPLICATION_STATUS_LABELS[stage]}
          </span>
        ))}
      </div>

      {isRejected ? (
        <p
          className="rise-in mt-1.5 flex items-center gap-1.5 text-[0.6875rem] font-medium
            text-status-rejected"
          aria-hidden="true"
        >
          <span>{STATUS_GLYPH.REJECTED}</span> Not progressing
        </p>
      ) : null}
    </div>
  );
}
