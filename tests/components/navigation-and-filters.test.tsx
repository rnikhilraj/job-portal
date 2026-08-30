import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CandidateSummary } from '@/components/candidate-summary';
import { DeleteJobButton } from '@/components/delete-job-button';
import { HrJobFilters } from '@/components/hr-job-filters';
import { JobFilters } from '@/components/job-filters';
import { LogoutButton } from '@/components/logout-button';
import { Reveal } from '@/components/reveal';
import { RouteTransition } from '@/components/route-transition';
import { SiteHeader } from '@/components/site-header';
import type { DiscoverableCandidate, PublicUser } from '@/modules/users/user.constants';

/**
 * The navigation shell, the URL-driven filter forms and the two small client
 * widgets. Individually modest, but between them they decide what each role can
 * reach and what a recruiter sees of a candidate, so they are worth pinning.
 */
const replace = jest.fn();
const refresh = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push }),
  usePathname: () => '/jobs',
}));

let requests: Array<{ url: string; method?: string }> = [];

function respondWith(status: number, payload: unknown): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method });
    return { status, ok: status >= 200 && status < 300, json: async () => payload };
  }) as unknown as typeof fetch;
}

function user(overrides: Partial<PublicUser> = {}): PublicUser {
  return {
    id: 'u1',
    email: 'sam@example.com',
    role: 'CANDIDATE',
    name: 'Sam Rivera',
    phone: null,
    headline: null,
    skills: [],
    isSearchable: false,
    experienceLevel: null,
    resume: null,
    ...overrides,
  };
}

function discoverable(overrides: Partial<DiscoverableCandidate> = {}): DiscoverableCandidate {
  return {
    id: 'c1',
    name: 'Asha Nair',
    headline: 'Distributed systems engineer',
    skills: ['Go', 'Kafka'],
    experienceLevel: 'SENIOR',
    email: 'asha@example.com',
    phone: '+91 90000 00000',
    resume: { originalName: 'asha-nair.pdf', sizeBytes: 512 * 1024 },
    ...overrides,
  };
}

beforeEach(() => {
  requests = [];
  replace.mockReset();
  refresh.mockReset();
  push.mockReset();
  respondWith(200, { data: { signedOut: true } });
});

describe('SiteHeader', () => {
  it('offers a signed-out visitor only the two ways in', () => {
    render(<SiteHeader user={null} />);

    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('shows candidate destinations to a candidate, and no recruiter tools', () => {
    render(<SiteHeader user={user()} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });

    expect(nav).toHaveTextContent('Browse roles');
    expect(nav).toHaveTextContent('My applications');
    expect(nav).toHaveTextContent('Profile');
    expect(nav).not.toHaveTextContent('Candidate search');
  });

  it('shows recruiter destinations to HR, and no candidate ones', () => {
    render(<SiteHeader user={user({ role: 'HR', name: 'Dana Okafor' })} />);
    const nav = screen.getByRole('navigation', { name: 'Main' });

    expect(nav).toHaveTextContent('My listings');
    expect(nav).toHaveTextContent('Candidate search');
    expect(nav).not.toHaveTextContent('My applications');
  });

  it('names the signed-in user and their role', () => {
    render(<SiteHeader user={user({ role: 'HR', name: 'Dana Okafor' })} />);

    expect(screen.getAllByText('Dana Okafor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HR').length).toBeGreaterThan(0);
  });
});

describe('LogoutButton', () => {
  it('posts to the logout endpoint and sends the user to the login page', async () => {
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ url: '/api/auth/logout', method: 'POST' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(refresh).toHaveBeenCalled();
  });

  it('says the session is still live when the request cannot be delivered', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    // Clearing the cookie is server-side, so a failed POST leaves the user
    // signed in. Navigating anyway would tell them a comfortable lie.
    expect(await screen.findByRole('alert')).toHaveTextContent(/still signed in/i);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /log out/i })).toBeEnabled();
  });

  it('reports the server’s own reason when it refuses', async () => {
    respondWith(500, {
      error: { code: 'INTERNAL_ERROR', message: 'Something broke on our side.' },
    });
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke on our side.');
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('DeleteJobButton', () => {
  it('spells out the cascade before deleting anything', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<DeleteJobButton jobId="job-1" jobTitle="Staff Engineer" />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    const message = confirmSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain('Staff Engineer');
    expect(message).toMatch(/every application/i);
    expect(message).toMatch(/resumes/i);
    expect(requests).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('deletes and refreshes once confirmed', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    respondWith(204, {});
    render(<DeleteJobButton jobId="job-1" jobTitle="Staff Engineer" />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ url: '/api/jobs/job-1', method: 'DELETE' });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    confirmSpy.mockRestore();
  });

  it('prefers the server’s reason over a generic connection message', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    respondWith(403, {
      error: { code: 'FORBIDDEN', message: 'You can only change listings you posted.' },
    });
    render(<DeleteJobButton jobId="job-1" jobTitle="Staff Engineer" />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(
      await screen.findByText(/You can only change listings you posted\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/the listing is unchanged/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('falls back to a connection message when the server cannot be reached', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    render(<DeleteJobButton jobId="job-1" jobTitle="Staff Engineer" />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});

describe('JobFilters', () => {
  it('is a plain GET form, so results stay shareable and work without JS', () => {
    const { container } = render(<JobFilters />);
    const form = container.querySelector('form');

    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/jobs');
  });

  it('reflects the filters currently in the URL', () => {
    render(<JobFilters q="platform" location="Remote" jobType="CONTRACT" />);

    expect(screen.getByLabelText(/keyword/i)).toHaveValue('platform');
    expect(screen.getByLabelText(/location/i)).toHaveValue('Remote');
    expect(screen.getByLabelText(/role type/i)).toHaveValue('CONTRACT');
  });

  it('offers "Any" as the unset role type', () => {
    render(<JobFilters />);
    expect(screen.getByLabelText(/role type/i)).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Any' })).toBeInTheDocument();
  });

  it('only offers to clear filters when some are applied', () => {
    const { unmount } = render(<JobFilters />);
    expect(screen.queryByRole('link', { name: /clear filters/i })).not.toBeInTheDocument();
    unmount();

    render(<JobFilters q="platform" />);
    expect(screen.getByRole('link', { name: /clear filters/i })).toHaveAttribute('href', '/jobs');
  });
});

describe('HrJobFilters', () => {
  it('is a GET form pointed at the recruiter’s own listings', () => {
    const { container } = render(<HrJobFilters />);
    const form = container.querySelector('form');

    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/hr/jobs');
  });

  it('reflects the current query and status', () => {
    render(<HrJobFilters q="engineer" status="CLOSED" />);

    expect(screen.getByLabelText(/search my listings/i)).toHaveValue('engineer');
    expect(screen.getByLabelText(/status/i)).toHaveValue('CLOSED');
  });

  it('offers to clear only once something is filtered', () => {
    const { unmount } = render(<HrJobFilters />);
    expect(screen.queryByRole('link', { name: /clear filters/i })).not.toBeInTheDocument();
    unmount();

    render(<HrJobFilters status="OPEN" />);
    expect(screen.getByRole('link', { name: /clear filters/i })).toHaveAttribute(
      'href',
      '/hr/jobs',
    );
  });
});

describe('CandidateSummary', () => {
  it('shows the contact details opting in grants', () => {
    render(<CandidateSummary candidate={discoverable()} />);

    expect(screen.getByRole('link', { name: 'asha@example.com' })).toHaveAttribute(
      'href',
      'mailto:asha@example.com',
    );
    expect(screen.getByText(/\+91 90000 00000/)).toBeInTheDocument();
    expect(screen.getByText('Distributed systems engineer')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
  });

  it('links the resume to the authorized handler, not a public file path', () => {
    render(<CandidateSummary candidate={discoverable()} />);

    const link = screen.getByRole('link', { name: /asha-nair\.pdf/ });
    expect(link).toHaveAttribute('href', '/api/candidates/c1/resume');
  });

  it('says so plainly when there is no resume', () => {
    render(<CandidateSummary candidate={discoverable({ resume: null })} />);

    expect(screen.getByText(/no resume uploaded/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /\.pdf/ })).not.toBeInTheDocument();
  });

  it('omits the optional fields rather than rendering empty chrome', () => {
    render(
      <CandidateSummary
        candidate={discoverable({ headline: null, phone: null, skills: [], experienceLevel: null })}
      />,
    );

    expect(screen.queryByText('Senior')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('drops the detail link when it is already the detail page', () => {
    render(<CandidateSummary candidate={discoverable()} headingLevel="h2" linkToDetail={false} />);

    expect(screen.queryByRole('link', { name: 'Asha Nair' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Asha Nair' })).toBeInTheDocument();
  });

  it('lists each skill as its own item', () => {
    render(<CandidateSummary candidate={discoverable()} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Go', 'Kafka']);
  });
});

describe('Reveal', () => {
  it('renders its content, so nothing depends on the animation running', () => {
    render(
      <Reveal>
        <p>Always readable</p>
      </Reveal>,
    );
    expect(screen.getByText('Always readable')).toBeInTheDocument();
  });

  it('leaves content untouched when the visitor prefers reduced motion', () => {
    const { setPrefersReducedMotion } = jest.requireActual<{
      setPrefersReducedMotion: (value: boolean) => void;
    }>('../../jest.setup.components');
    setPrefersReducedMotion(true);

    const { container } = render(
      <Reveal delayMs={120}>
        <p>Still readable</p>
      </Reveal>,
    );

    // The hiding class is only ever added by the effect, so opting out of motion
    // can never leave content permanently invisible.
    expect(container.firstElementChild).not.toHaveClass('reveal');
    setPrefersReducedMotion(false);
  });

  it('reveals the element once it scrolls into view, then stops watching it', () => {
    // The shared stub never fires its callback, so this one captures it and
    // drives the intersection by hand.
    let fire: ((entries: Array<Partial<IntersectionObserverEntry>>) => void) | null = null;
    const unobserve = jest.fn();
    const original = window.IntersectionObserver;

    class CapturingObserver {
      constructor(callback: (entries: Array<Partial<IntersectionObserverEntry>>) => void) {
        fire = callback;
      }
      observe = () => {};
      unobserve = unobserve;
      disconnect = () => {};
      takeRecords = () => [];
      root = null;
      rootMargin = '';
      thresholds: ReadonlyArray<number> = [];
    }
    window.IntersectionObserver = CapturingObserver as unknown as typeof IntersectionObserver;

    const { container } = render(
      <Reveal>
        <p>Scrolls in</p>
      </Reveal>,
    );
    const node = container.firstElementChild as HTMLElement;

    // Off screen: hidden, and still being watched.
    fire!([{ isIntersecting: false, target: node }]);
    expect(node).not.toHaveClass('is-revealed');
    expect(unobserve).not.toHaveBeenCalled();

    fire!([{ isIntersecting: true, target: node }]);
    expect(node).toHaveClass('is-revealed');
    // Fires exactly once, then unhooks itself rather than watching forever.
    expect(unobserve).toHaveBeenCalledWith(node);

    window.IntersectionObserver = original;
  });

  it('adds the reveal class and the requested delay otherwise', () => {
    const { container } = render(
      <Reveal delayMs={200}>
        <p>Animated</p>
      </Reveal>,
    );

    const node = container.firstElementChild as HTMLElement;
    expect(node).toHaveClass('reveal');
    expect(node.style.transitionDelay).toBe('200ms');
  });
});

describe('RouteTransition', () => {
  it('wraps its children in the enter animation', () => {
    const { container } = render(
      <RouteTransition>
        <p>Page body</p>
      </RouteTransition>,
    );

    expect(container.firstElementChild).toHaveClass('route-enter');
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
