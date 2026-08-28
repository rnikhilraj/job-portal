'use client';

import { useEffect, useRef } from 'react';

/**
 * Scroll-triggered reveal, used only on the landing page.
 *
 * IntersectionObserver rather than a scroll listener or a library: it costs
 * nothing per frame and unobserves once fired, so an element animates exactly
 * once and then stops being watched.
 *
 * Content is visible from the start for anyone with reduced motion or without
 * JavaScript — the `reveal` class that hides it is only added by this effect,
 * so the page can never leave content permanently invisible.
 */
export function Reveal({
  children,
  delayMs = 0,
  className = '',
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    node.classList.add('reveal');
    node.style.transitionDelay = `${delayMs}ms`;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delayMs]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
