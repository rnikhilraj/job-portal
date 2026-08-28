import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PipelineFunnel, StatusChip } from '@/components/pipeline';
import { PipelineHero } from '@/components/pipeline-hero';
import { StatusBadge } from '@/components/status-badge';

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
  it('opens on Applied and walks forward on its own', async () => {
    jest.useFakeTimers();
    try {
      render(<PipelineHero />);
      expect(screen.getByText(/your application is in/i)).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(1200);
      });
      expect(screen.getByText(/someone has actually opened it/i)).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(1200);
      });
      expect(screen.getByText(/through to the next round/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('lands on the finished frame immediately under reduced motion', async () => {
    setPrefersReducedMotion(true);
    jest.useFakeTimers();
    try {
      render(<PipelineHero />);
      // No journey — the sequence is skipped, not merely sped up.
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(screen.getByText(/through to the next round/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('lets a visitor scrub to any stage', async () => {
    render(<PipelineHero />);

    await userEvent.click(screen.getByRole('button', { name: /show the reviewed stage/i }));

    expect(screen.getByText(/someone has actually opened it/i)).toBeInTheDocument();
  });

  it('shows the rejection branch, and reads as terminal rather than punitive', async () => {
    render(<PipelineHero />);

    await userEvent.click(screen.getByRole('button', { name: /see a rejection/i }));

    expect(screen.getByText(/the rail stops rather than pretending otherwise/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replay the journey/i })).toBeInTheDocument();
  });

  it('announces the stage change politely', () => {
    render(<PipelineHero />);
    expect(screen.getByText(/your application is in/i)).toHaveAttribute('aria-live', 'polite');
  });

  it('cleans up its timers on unmount', () => {
    jest.useFakeTimers();
    try {
      const { unmount } = render(<PipelineHero />);
      unmount();
      // Nothing should still be queued to fire into a dead component.
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
