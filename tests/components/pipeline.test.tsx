import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PipelineFunnel, StatusChip } from '@/components/pipeline';
import { PipelineHero } from '@/components/pipeline-hero';
import { StatusBadge } from '@/components/status-badge';
import { FEATURED_SAMPLE_JOB } from '@/modules/jobs/job.samples';

import { setPrefersReducedMotion } from '../../jest.setup.components';

/**
 * The pipeline family is the app's signature element and its accessibility
 * mechanism: green and rose collapse to near-identical colours under
 * deuteranopia, so every status must also carry a glyph and a text label.
 * These assert that redundancy directly.
 */
describe('StatusChip', () => {
  it.each([
    ['APPLIED', 'Applied'],
    ['REVIEWED', 'Reviewed'],
    ['SHORTLISTED', 'Shortlisted'],
    ['REJECTED', 'Rejected'],
  ] as const)('labels %s in words, not colour alone', (status, label) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('pairs the label with a glyph that is hidden from screen readers', () => {
    const { container } = render(<StatusChip status="SHORTLISTED" />);
    // The glyph is decoration on top of the word, never a replacement for it.
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('StatusBadge (job status)', () => {
  it.each([
    ['OPEN', 'Open'],
    ['CLOSED', 'Closed'],
  ] as const)('labels %s in words', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('PipelineFunnel', () => {
  const counts = { APPLIED: 4, REVIEWED: 3, SHORTLISTED: 2, REJECTED: 1 };

  it('prints every count, so the bar summarises numbers rather than replacing them', () => {
    render(<PipelineFunnel counts={counts} total={10} />);

    // The counts live in a <dl>, which exposes term/definition rather than list.
    // Typed as tuples so noUncheckedIndexedAccess does not widen them to
    // `string | undefined` on destructuring.
    const expected: Array<[label: string, count: string]> = [
      ['Applied', '4'],
      ['Reviewed', '3'],
      ['Shortlisted', '2'],
      ['Rejected', '1'],
    ];

    for (const [label, count] of expected) {
      expect(screen.getByText(count)).toBeInTheDocument();
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('sizes each segment by its share of the total', () => {
    const { container } = render(<PipelineFunnel counts={counts} total={10} />);
    const widths = Array.from(container.querySelectorAll<HTMLElement>('[style*="width"]')).map(
      (el) => el.style.width,
    );

    expect(widths).toEqual(['40%', '30%', '20%', '10%']);
  });

  it('omits a segment for a stage nobody is at', () => {
    const { container } = render(
      <PipelineFunnel counts={{ ...counts, REJECTED: 0 }} total={9} />,
    );
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(3);
  });

  it('renders nothing at all when there are no applicants', () => {
    const { container } = render(
      <PipelineFunnel
        counts={{ APPLIED: 0, REVIEWED: 0, SHORTLISTED: 0, REJECTED: 0 }}
        total={0}
      />,
    );
    // The applicants page shows a designed empty state instead.
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PipelineHero', () => {
  /**
   * The hero is static now, and static is the thing worth guarding: it is a
   * server component with no state, no timers and no JavaScript, and the easy
   * regression is for someone to reintroduce motion or a dead control.
   */
  it('rests at Applied and never moves off it', async () => {
    jest.useFakeTimers();
    try {
      render(<PipelineHero />);
      expect(screen.getByText(/your application is in/i)).toBeInTheDocument();

      // A minute of virtual time later it has not advanced a single stage.
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByText(/your application is in/i)).toBeInTheDocument();
      expect(screen.queryByText(/someone has actually opened it/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/through to the next round/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('schedules nothing at all', () => {
    jest.useFakeTimers();
    try {
      render(<PipelineHero />);
      // No autoplay, no crossings, no cleanup to get wrong.
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs no animation of its own', () => {
    const { container } = render(<PipelineHero />);

    // Nothing plays on load; the only motion is a transition after a press.
    expect(container.querySelector('.hero-rail-fill')).toBeNull();
    expect(container.querySelector('.hero-card-travel')).toBeNull();
  });

  /*
   * The stages are the hero's only interaction, so each one is pinned: it moves
   * the card, it reports itself as pressed, and it is reachable by its name
   * rather than by a 24px dot with no text.
   */
  it.each([
    ['Reviewed', /someone has actually opened it/i],
    ['Shortlisted', /through to the next round/i],
  ])('moves to %s when its stage is pressed', async (label, blurb) => {
    render(<PipelineHero />);

    await userEvent.click(screen.getByRole('button', { name: `Show the ${label} stage` }));

    expect(screen.getByText(blurb)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Show the ${label} stage` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('fills the rail further the later the stage pressed', async () => {
    const { container } = render(<PipelineHero />);
    const fill = () => container.querySelector('.bg-petrol-500') as HTMLElement;

    expect(fill().style.transform).toBe('scaleX(0)');

    await userEvent.click(screen.getByRole('button', { name: /show the reviewed stage/i }));
    expect(fill().style.transform).toBe('scaleX(0.5)');

    await userEvent.click(screen.getByRole('button', { name: /show the shortlisted stage/i }));
    expect(fill().style.transform).toBe('scaleX(1)');
  });

  it('can be pressed back down the rail again', async () => {
    render(<PipelineHero />);

    await userEvent.click(screen.getByRole('button', { name: /show the shortlisted stage/i }));
    await userEvent.click(screen.getByRole('button', { name: /show the applied stage/i }));

    expect(screen.getByText(/your application is in/i)).toBeInTheDocument();
  });

  it('still responds to a press under reduced motion', async () => {
    setPrefersReducedMotion(true);
    render(<PipelineHero />);

    await userEvent.click(screen.getByRole('button', { name: /show the shortlisted stage/i }));

    // The preference removes the travel, never the ability to get there: the
    // app-wide rule collapses the transition, so the click lands instantly.
    expect(screen.getByText(/through to the next round/i)).toBeInTheDocument();
  });

  it('announces the stage, since every change is one the visitor asked for', () => {
    render(<PipelineHero />);
    expect(screen.getByText(/your application is in/i)).toHaveAttribute('aria-live', 'polite');
  });

  it('stamps the receipt with today, not a hardcoded date', () => {
    render(<PipelineHero />);

    const expected = new Date().toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
    // The date it used to ship with, pinned so it cannot creep back.
    expect(screen.queryByText(/12 Mar/)).not.toBeInTheDocument();
  });

  it('shows one stamp on load, and more as stages are pressed', async () => {
    const { container } = render(<PipelineHero />);
    const receipt = () => container.querySelectorAll('ol')[1];

    expect(receipt()?.querySelectorAll('li')).toHaveLength(1);
    expect(receipt()?.textContent).toMatch(/Applied/);

    await userEvent.click(screen.getByRole('button', { name: /show the shortlisted stage/i }));
    expect(receipt()?.querySelectorAll('li')).toHaveLength(3);
  });

  it('keeps the card content it is meant to keep', () => {
    render(<PipelineHero />);

    expect(screen.getByText(FEATURED_SAMPLE_JOB.title)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FEATURED_SAMPLE_JOB.location))).toBeInTheDocument();
    expect(screen.getByText(/Northwind Labs/)).toBeInTheDocument();
    // Status still reads as a word, not colour alone.
    expect(screen.getAllByText('Applied').length).toBeGreaterThan(0);
  });

  it('names every stage in words, even the ones not reached', () => {
    render(<PipelineHero />);

    for (const label of ['Applied', 'Reviewed', 'Shortlisted']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
