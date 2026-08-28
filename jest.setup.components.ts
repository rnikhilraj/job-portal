import '@testing-library/jest-dom';

/**
 * Component tests run in jsdom, which implements neither matchMedia nor
 * IntersectionObserver — both of which this app's motion code checks before it
 * animates. Stubbing them here means a component under test takes the same
 * branch it would in a real browser rather than throwing.
 */
const prefersReducedMotion = { current: false };

/** Lets a test opt into the reduced-motion branch. */
export function setPrefersReducedMotion(value: boolean): void {
  prefersReducedMotion.current = value;
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? prefersReducedMotion.current : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe = () => {};
    unobserve = () => {};
    disconnect = () => {};
    takeRecords = () => [];
  }
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  prefersReducedMotion.current = false;
  window.localStorage.clear();
});
