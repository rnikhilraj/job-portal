import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProfileForm } from '@/components/profile-form';
import type { PublicUser } from '@/modules/users/user.constants';

/**
 * The profile form is where a candidate consents to being found. The tests that
 * matter here are less about the text fields than about that toggle: what it
 * says in each state, and that an HR account is never offered it at all.
 */
type Recorded = { url: string; method?: string; body: Record<string, unknown> };
let requests: Recorded[] = [];

function respondWith(status: number, payload: unknown): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    return { status, ok: status >= 200 && status < 300, json: async () => payload };
  }) as unknown as typeof fetch;
}

function candidate(overrides: Partial<PublicUser> = {}): PublicUser {
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

const savedResponse = (user: PublicUser) => ({ data: user });

beforeEach(() => {
  requests = [];
  respondWith(200, savedResponse(candidate()));
});

describe('ProfileForm — editable fields', () => {
  it('PATCHes only the profile fields, never email or role', async () => {
    const user = candidate();
    respondWith(200, savedResponse({ ...user, name: 'Sam R.' }));
    render(<ProfileForm user={user} />);

    await userEvent.clear(screen.getByLabelText(/full name/i));
    await userEvent.type(screen.getByLabelText(/full name/i), 'Sam R.');
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.url).toBe('/api/users/me');
    expect(requests[0]?.method).toBe('PATCH');
    expect(requests[0]?.body).not.toHaveProperty('email');
    expect(requests[0]?.body).not.toHaveProperty('role');
    expect(requests[0]?.body).not.toHaveProperty('id');
  });

  it('shows email and role as fixed text rather than inputs', () => {
    render(<ProfileForm user={candidate()} />);

    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
    expect(screen.getByText(/an administrator handles those/i)).toBeInTheDocument();
  });

  it('normalises comma-separated skills before sending them', async () => {
    render(<ProfileForm user={candidate()} />);

    await userEvent.type(screen.getByLabelText(/skills/i), 'TypeScript, , typescript,  MongoDB ');
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    // Blank entries dropped, case-insensitive duplicates collapsed, edges trimmed.
    expect(requests[0]?.body.skills).toEqual(['TypeScript', 'MongoDB']);
  });

  it('re-seeds its inputs from the server response, not from local state', async () => {
    const user = candidate({ skills: [] });
    respondWith(200, savedResponse({ ...user, skills: ['TypeScript', 'MongoDB'] }));
    render(<ProfileForm user={user} />);

    await userEvent.type(screen.getByLabelText(/skills/i), 'typescript,,MONGODB');
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    // The server's tidied list wins over whatever was typed.
    await waitFor(() =>
      expect(screen.getByLabelText(/skills/i)).toHaveValue('TypeScript, MongoDB'),
    );
  });

  it('confirms a save happened', async () => {
    render(<ProfileForm user={candidate()} />);
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/saved at/i);
  });
});

describe('ProfileForm — the recruiter visibility opt-in', () => {
  it('is off by default and says nothing is shared', () => {
    render(<ProfileForm user={candidate({ isSearchable: false })} />);

    expect(screen.getByLabelText(/make my profile visible to recruiters/i)).not.toBeChecked();
    expect(screen.getByText(/invisible to recruiters right now/i)).toBeInTheDocument();
  });

  it('names email, phone and resume as what opting in exposes', () => {
    render(<ProfileForm user={candidate()} />);

    // The consent has to be informed, so the copy is pinned rather than assumed.
    expect(
      screen.getByText(/email address, phone number and uploaded resume/i),
    ).toBeInTheDocument();
  });

  it('changes its warning the moment the box is ticked, before any save', async () => {
    render(<ProfileForm user={candidate({ isSearchable: false })} />);

    await userEvent.click(screen.getByLabelText(/make my profile visible to recruiters/i));

    expect(screen.getByText(/you are discoverable right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/invisible to recruiters right now/i)).not.toBeInTheDocument();
  });

  it('sends the opt-in when it is turned on', async () => {
    const user = candidate({ isSearchable: false });
    respondWith(200, savedResponse({ ...user, isSearchable: true }));
    render(<ProfileForm user={user} />);

    await userEvent.click(screen.getByLabelText(/make my profile visible to recruiters/i));
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body.isSearchable).toBe(true);
  });

  it('sends the opt-out when it is turned back off', async () => {
    const user = candidate({ isSearchable: true });
    respondWith(200, savedResponse({ ...user, isSearchable: false }));
    render(<ProfileForm user={user} />);

    await userEvent.click(screen.getByLabelText(/make my profile visible to recruiters/i));
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body.isSearchable).toBe(false);
  });

  it('treats "Not specified" as clearing the experience level', async () => {
    const user = candidate({ experienceLevel: 'SENIOR' });
    respondWith(200, savedResponse({ ...user, experienceLevel: null }));
    render(<ProfileForm user={user} />);

    expect(screen.getByLabelText('Experience level')).toHaveValue('SENIOR');
    await userEvent.selectOptions(screen.getByLabelText('Experience level'), '');
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    /*
     * Explicitly null on the wire, not merely absent. An absent key reads as
     * "not mentioned" and leaves the old value in place — which is exactly the
     * bug this assertion exists to prevent coming back.
     */
    expect(requests[0]?.body).toHaveProperty('experienceLevel', null);
  });
});

describe('ProfileForm — an HR account', () => {
  const hr = candidate({ role: 'HR', name: 'Dana Okafor', email: 'hr@example.com' });

  it('is never shown the candidate-only opt-in', () => {
    render(<ProfileForm user={hr} />);

    expect(
      screen.queryByLabelText(/make my profile visible to recruiters/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Experience level')).not.toBeInTheDocument();
  });

  it('does not send the candidate-only fields the API would reject', async () => {
    respondWith(200, savedResponse(hr));
    render(<ProfileForm user={hr} />);

    await userEvent.type(screen.getByLabelText(/headline/i), 'Talent partner');
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body).not.toHaveProperty('isSearchable');
    expect(requests[0]?.body).not.toHaveProperty('experienceLevel');
  });
});

describe('ProfileForm — failures', () => {
  it('shows per-field messages from a rejected save', async () => {
    respondWith(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some of those fields need another look.',
        details: { phone: ['Digits and + ( ) - . only, please.'] },
      },
    });
    render(<ProfileForm user={candidate()} />);
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    expect(await screen.findByText(/digits and \+ \( \) - \. only/i)).toBeInTheDocument();
  });

  it('says the profile was not saved when the server is unreachable', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    render(<ProfileForm user={candidate()} />);

    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/was not saved/i);
  });

  it('catches a bad phone number locally, without a request', async () => {
    render(<ProfileForm user={candidate()} />);

    await userEvent.type(screen.getByLabelText('Phone'), 'call me maybe');
    await userEvent.click(screen.getByRole('button', { name: /save my profile/i }));

    expect(await screen.findByText(/digits and \+ \( \) - \. only/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});
