import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileNav } from '@/components/mobile-nav';
import type { PublicUser } from '@/modules/users/user.constants';

/**
 * The panel's open state is derived from the route it was opened on rather than
 * held in a boolean and reset by an effect. These pin the behaviour that
 * refactor has to preserve — particularly that navigating closes it, which used
 * to be an explicit effect and is now a consequence of the derivation.
 */
let pathname = '/hr/jobs';
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

const LINKS = [
  { href: '/hr/jobs', label: 'My listings' },
  { href: '/hr/candidates', label: 'Candidate search' },
];

const HR: PublicUser = {
  id: 'u1',
  email: 'priya@example.com',
  role: 'HR',
  name: 'Priya Menon',
  phone: null,
  headline: null,
  skills: [],
  isSearchable: false,
  experienceLevel: null,
  resume: null,
};

beforeEach(() => {
  pathname = '/hr/jobs';
});

function openMenu() {
  return userEvent.click(screen.getByRole('button', { name: /menu/i }));
}

describe('MobileNav', () => {
  it('starts closed and exposes that to assistive tech', () => {
    render(<MobileNav user={HR} links={LINKS} />);

    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('opens on click and reveals every destination', async () => {
    render(<MobileNav user={HR} links={LINKS} />);
    await openMenu();

    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'My listings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Candidate search' })).toBeInTheDocument();
  });

  it('toggles shut on a second click', async () => {
    render(<MobileNav user={HR} links={LINKS} />);
    await openMenu();
    await openMenu();

    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape', async () => {
    render(<MobileNav user={HR} links={LINKS} />);
    await openMenu();

    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a click outside, but not on one inside', async () => {
    render(
      <div>
        <MobileNav user={HR} links={LINKS} />
        <button type="button">elsewhere</button>
      </div>,
    );
    await openMenu();

    // Inside the panel: stays open.
    await userEvent.click(screen.getByText('priya@example.com'));
    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when the route changes, without an effect doing it', async () => {
    const { rerender } = render(<MobileNav user={HR} links={LINKS} />);
    await openMenu();
    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'true');

    // Navigation: the derived state closes it because the path no longer
    // matches the one it was opened on.
    pathname = '/hr/candidates';
    rerender(<MobileNav user={HR} links={LINKS} />);

    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the signed-in identity and a way out', async () => {
    render(<MobileNav user={HR} links={LINKS} />);
    await openMenu();

    expect(screen.getByText('Priya Menon')).toBeInTheDocument();
    expect(screen.getByText('HR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('offers log in and sign up when nobody is signed in', async () => {
    render(<MobileNav user={null} links={[]} />);
    await openMenu();

    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});
