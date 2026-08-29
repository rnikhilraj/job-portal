import { render, screen } from '@testing-library/react';

import { ExamplePostings } from '@/components/example-postings';
import { ProductStory } from '@/components/product-story';
import {
  SAMPLE_EMPLOYERS,
  SAMPLE_JOBS,
  sampleEmployerHeadline,
} from '@/modules/jobs/job.samples';

/**
 * The landing page's two narrative sections.
 *
 * Both of these make claims to a visitor, so what is pinned here is honesty
 * rather than layout: the postings marquee must not read as a customer list,
 * and the story must not invent a hiring stage the pipeline does not have.
 * Those are the two ways this page could quietly start lying as it is edited.
 */
describe('ExamplePostings', () => {
  it('shows every listing the seeder actually writes, exactly once', () => {
    render(<ExamplePostings />);

    for (const job of SAMPLE_JOBS) {
      expect(screen.getByText(job.title)).toBeInTheDocument();
    }
  });

  /*
   * The org name a card shows and the headline the seeder writes onto that HR
   * account come from one record. If they were typed separately, the landing
   * page could advertise an employer the database has never heard of.
   */
  it('shows the same employer name the seeder puts on the account', () => {
    render(<ExamplePostings />);

    const employer = SAMPLE_EMPLOYERS['hr1@example.com'];
    expect(screen.getAllByText(employer.org).length).toBeGreaterThan(0);
    expect(sampleEmployerHeadline('hr1@example.com')).toContain(employer.org);
    expect(sampleEmployerHeadline('hr2@example.com')).toContain(
      SAMPLE_EMPLOYERS['hr2@example.com'].org,
    );
  });

  it('frames the listings as fixtures rather than as customers', () => {
    render(<ExamplePostings />);

    expect(screen.getByText(/fixtures, not customers/i)).toBeInTheDocument();
    // A "trusted by" claim would be untrue — nobody has adopted this product.
    expect(screen.queryByText(/trusted by/i)).not.toBeInTheDocument();
  });

  it('makes the scrolling strip reachable from the keyboard', () => {
    render(<ExamplePostings />);

    // A region that scrolls but cannot be focused hides its overflow from
    // anyone without a pointer.
    const strip = screen.getByRole('region', { name: /example postings/i });
    expect(strip).toHaveAttribute('tabindex', '0');
    expect(strip).toHaveClass('scroll-strip');
  });

  it('keeps the strip inside the page container rather than full-bleed', () => {
    render(<ExamplePostings />);

    const strip = screen.getByRole('region', { name: /example postings/i });
    // The heading and the strip must share one set of margins.
    expect(strip.parentElement).toHaveClass('max-w-6xl');
    expect(strip.parentElement?.className).toMatch(/px-4/);
  });
});

describe('ProductStory', () => {
  it('tells the four stages the product actually implements', () => {
    render(<ProductStory />);

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(['Search', 'Apply', 'Track', 'Shortlisted']);
  });

  it('does not invent a hiring stage the pipeline cannot deliver', () => {
    render(<ProductStory />);

    expect(screen.queryByText(/\bhired\b/i)).not.toBeInTheDocument();
    expect(screen.getByText(/where this pipeline ends/i)).toBeInTheDocument();
  });

  it('keeps the UI fragments out of the tab order and the a11y tree', () => {
    const { container } = render(<ProductStory />);

    const fragments = container.querySelectorAll('[aria-hidden="true"][inert]');
    // One per stage: search, apply, track, shortlisted.
    expect(fragments).toHaveLength(4);
  });

  it('sends a signed-out visitor to signup rather than at a guarded route', () => {
    render(<ProductStory />);

    // /jobs is behind requirePageUser, so a "browse" CTA here would bounce.
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toEqual(['/signup', '/login']);
  });
});

describe('the story fragments quote real seed data', () => {
  it('lists real open listings as the search results', () => {
    render(<ProductStory />);

    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Bengaluru, India')).toBeInTheDocument();
  });

  it('never shows a closed listing as a live search result', () => {
    render(<ProductStory />);

    const closed = SAMPLE_JOBS.find((job) => job.status === 'CLOSED');
    expect(closed).toBeDefined();
    expect(screen.queryByText(closed!.title)).not.toBeInTheDocument();
  });
});
