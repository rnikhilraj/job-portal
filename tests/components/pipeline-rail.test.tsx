import { act, render, screen } from '@testing-library/react';

import { PipelineRail } from '@/components/pipeline-rail';

import { setPrefersReducedMotion } from '../../jest.setup.components';

/**
 * The rail is the product's emotional centrepiece and, until now, the only
 * substantial piece of client logic with no test at all. That gap let a real
 * bug ship: the inner requestAnimationFrame handle was never captured, so
 * unmounting between the two frames fired setState on a dead component.
 */
const SEEN_KEY = 'jat:seen-status:app-1';

/** The rail's accessible description is the thing screen readers actually get. */
function currentDescription(): string {
  return screen.getByText(/stage \d of 3|Rejected after review/).textContent ?? '';
}

/** Advances past both queued animation frames. */
async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

describe('PipelineRail — static rendering', () => {
  it.each([
    ['APPLIED', 'Applied — stage 1 of 3'],
    ['REVIEWED', 'Reviewed — stage 2 of 3'],
    ['SHORTLISTED', 'Shortlisted — stage 3 of 3'],
  ] as const)('describes %s as "%s" for assistive tech', (status, expected) => {
    render(<PipelineRail status={status} />);
    expect(currentDescription()).toBe(expected);
  });

  it('describes rejection as terminal rather than as a fourth stage', () => {
    render(<PipelineRail status="REJECTED" />);
    expect(currentDescription()).toBe('Rejected after review');
    expect(screen.getByText(/Not progressing/)).toBeInTheDocument();
  });

  it('announces changes politely rather than interrupting', () => {
    render(<PipelineRail status="REVIEWED" />);
    expect(screen.getByText(/stage 2 of 3/)).toHaveAttribute('aria-live', 'polite');
  });

  it('renders nothing interactive — it is a status display, not a control', () => {
    render(<PipelineRail status="REVIEWED" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PipelineRail — remembering what the viewer last saw', () => {
  it('records the status on first sight, without animating', async () => {
    render(<PipelineRail status="APPLIED" applicationId="app-1" />);
    await flushFrames();

    expect(window.localStorage.getItem(SEEN_KEY)).toBe('APPLIED');
    expect(currentDescription()).toBe('Applied — stage 1 of 3');
  });

  it('starts from the previously seen status, then transitions to the current one', async () => {
    window.localStorage.setItem(SEEN_KEY, 'APPLIED');

    render(<PipelineRail status="SHORTLISTED" applicationId="app-1" />);

    // Before the frames run, the rail is still showing what the viewer last saw —
    // that is what makes the transition visible instead of instant.
    expect(currentDescription()).toBe('Applied — stage 1 of 3');

    await flushFrames();
    expect(currentDescription()).toBe('Shortlisted — stage 3 of 3');
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('SHORTLISTED');
  });

  it('stays calm on a second visit with no change', async () => {
    window.localStorage.setItem(SEEN_KEY, 'REVIEWED');

    render(<PipelineRail status="REVIEWED" applicationId="app-1" />);

    expect(currentDescription()).toBe('Reviewed — stage 2 of 3');
    await flushFrames();
    expect(currentDescription()).toBe('Reviewed — stage 2 of 3');
  });

  it('lands on the final state immediately when reduced motion is preferred', async () => {
    setPrefersReducedMotion(true);
    window.localStorage.setItem(SEEN_KEY, 'APPLIED');

    render(<PipelineRail status="SHORTLISTED" applicationId="app-1" />);

    // No journey: the viewer sees the outcome, not the animation.
    expect(currentDescription()).toBe('Shortlisted — stage 3 of 3');
    await flushFrames();
    expect(currentDescription()).toBe('Shortlisted — stage 3 of 3');
  });

  it('keeps each application separate', async () => {
    window.localStorage.setItem('jat:seen-status:app-A', 'APPLIED');

    render(<PipelineRail status="REVIEWED" applicationId="app-B" />);
    await flushFrames();

    expect(window.localStorage.getItem('jat:seen-status:app-A')).toBe('APPLIED');
    expect(window.localStorage.getItem('jat:seen-status:app-B')).toBe('REVIEWED');
  });

  it('does not touch storage when no applicationId is given', async () => {
    render(<PipelineRail status="REVIEWED" />);
    await flushFrames();

    expect(window.localStorage.length).toBe(0);
  });

  it('degrades quietly when storage is unavailable', async () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    // Private browsing and blocked site data must not break the page.
    expect(() => render(<PipelineRail status="SHORTLISTED" applicationId="app-1" />)).not.toThrow();
    expect(currentDescription()).toBe('Shortlisted — stage 3 of 3');

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('PipelineRail — cleanup', () => {
  /**
   * Pins the bug this suite was written after: the inner requestAnimationFrame
   * handle was returned from a callback whose return value is discarded, so
   * cleanup cancelled only the outer frame.
   *
   * An earlier version of this test asserted that React logged no error on
   * unmount — which passed even with the bug present, because React 19 dropped
   * the setState-after-unmount warning. It was therefore worthless. This
   * version drives the frame queue directly and asserts the real contract:
   * every frame the component requests is a frame it cancels.
   */
  it('cancels every frame it requested, including the nested one', () => {
    const issued: number[] = [];
    const cancelled: number[] = [];
    let queue: Array<{ id: number; callback: FrameRequestCallback }> = [];
    let nextId = 1;

    const realRaf = window.requestAnimationFrame;
    const realCancel = window.cancelAnimationFrame;

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = nextId++;
      issued.push(id);
      queue.push({ id, callback });
      return id;
    }) as typeof window.requestAnimationFrame;

    window.cancelAnimationFrame = ((id: number) => {
      cancelled.push(id);
      queue = queue.filter((frame) => frame.id !== id);
    }) as typeof window.cancelAnimationFrame;

    const runOneFrame = () => {
      const pending = queue;
      queue = [];
      act(() => {
        pending.forEach(({ callback }) => callback(0));
      });
    };

    try {
      window.localStorage.setItem(SEEN_KEY, 'APPLIED');
      const { unmount } = render(<PipelineRail status="SHORTLISTED" applicationId="app-1" />);

      // The outer frame fires and queues the inner one...
      runOneFrame();
      expect(issued).toHaveLength(2);

      // ...and the viewer navigates away before it can run.
      unmount();

      expect(cancelled).toEqual(expect.arrayContaining(issued));
      expect(queue).toHaveLength(0);
    } finally {
      window.requestAnimationFrame = realRaf;
      window.cancelAnimationFrame = realCancel;
    }
  });
});
