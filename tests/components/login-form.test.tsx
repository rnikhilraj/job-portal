import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LoginForm } from '@/app/(auth)/login/login-form';
import type { PublicUser } from '@/modules/users/user.constants';

/**
 * The form's own job is small — validate, POST, then navigate — but that last
 * step is the interesting one. `?next=` is set by whoever wrote the link, and
 * the navigation happens immediately after a real sign-in, which is the moment
 * a user is least likely to question where they have landed.
 *
 * `safeRedirectPath` is unit-tested separately; these tests exist because the
 * bug that mattered was never in the validator, it was in whether the component
 * called one at all.
 */
const replace = jest.fn();
const refresh = jest.fn();
let nextParam: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => new URLSearchParams(nextParam === null ? '' : `next=${nextParam}`),
}));

function signInAs(role: PublicUser['role']): void {
  global.fetch = jest.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ data: { id: 'u1', email: 'sam@example.com', role } }),
  })) as unknown as typeof fetch;
}

async function submitCredentials(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/email/i), 'sam@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'Passw0rd123');
  await userEvent.click(screen.getByRole('button', { name: /log in/i }));
}

beforeEach(() => {
  nextParam = null;
  replace.mockClear();
  refresh.mockClear();
  signInAs('CANDIDATE');
});

describe('LoginForm — where it sends you afterwards', () => {
  it('sends each role to its own home when there is no next parameter', async () => {
    signInAs('HR');
    render(<LoginForm />);

    await submitCredentials();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/hr/jobs'));
  });

  it('honours a legitimate next parameter, filters and all', async () => {
    // This is the behaviour the parameter exists for, and it must survive the
    // validation added around it.
    nextParam = encodeURIComponent('/jobs?q=react&page=2');
    render(<LoginForm />);

    await submitCredentials();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/jobs?q=react&page=2'));
  });
});

describe('LoginForm — an off-origin next is never followed', () => {
  /**
   * Each of these is a link an attacker can hand to a victim. The sign-in
   * itself succeeds; the question is only whether the browser is then handed
   * to someone else's site with the user's trust freshly established.
   */
  const hostileDestinations = [
    ['an absolute URL', 'https://evil.example/login'],
    ['a scheme-relative URL', '//evil.example'],
    ['a backslash the URL parser rewrites to a slash', '/\\evil.example'],
    ['a javascript: URL', 'javascript:alert(1)'],
  ] as const;

  it.each(hostileDestinations)('ignores %s and uses the role default', async (_label, hostile) => {
    nextParam = encodeURIComponent(hostile);
    render(<LoginForm />);

    await submitCredentials();

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    // Fell back to the candidate's home rather than the supplied destination.
    expect(replace).toHaveBeenCalledWith('/jobs');
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('evil.example'));
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining('javascript:'));
  });
});
