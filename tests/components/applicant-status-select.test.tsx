import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicantStatusSelect } from '@/components/applicant-status-select';

/**
 * The status control makes an optimistic update and rolls back if the server
 * refuses. That rollback is a correctness claim — the control must never show a
 * stage the server did not accept — and it was previously untested.
 *
 * `fetch` is stubbed rather than the http module, so these exercise the real
 * apiFetch envelope parsing and the real ApiRequestError construction on the
 * way through. A test that mocked patchJson would prove much less.
 */
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

type FetchArgs = { url: string; body: unknown };
let calls: FetchArgs[] = [];

/**
 * jsdom provides no global Response, so the stub returns the three members
 * apiFetch actually reads rather than a real one. Constructing `new Response()`
 * here throws a ReferenceError that apiFetch would report as a transport
 * failure — which silently turned an earlier version of these tests green
 * against the wrong branch.
 */
function fakeResponse(status: number, payload: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => payload,
  };
}

function respondWith(status: number, payload: unknown): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? 'null')) });
    return fakeResponse(status, payload);
  }) as unknown as typeof fetch;
}

function failTransport(): void {
  global.fetch = jest.fn(async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
});

describe('ApplicantStatusSelect', () => {
  it('sends the chosen stage to this application only', async () => {
    respondWith(200, { data: { id: 'app-7', status: 'SHORTLISTED' } });
    render(<ApplicantStatusSelect applicationId="app-7" status="APPLIED" />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'SHORTLISTED');

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.url).toBe('/api/applications/app-7');
    expect(calls[0]?.body).toEqual({ status: 'SHORTLISTED' });
  });

  it('updates optimistically so the control feels immediate', async () => {
    let release!: () => void;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve(fakeResponse(200, { data: {} }));
        }),
    ) as unknown as typeof fetch;

    render(<ApplicantStatusSelect applicationId="app-7" status="APPLIED" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'REVIEWED');

    // Still in flight, already showing the new value.
    expect(screen.getByRole('combobox')).toHaveValue('REVIEWED');

    // Settle inside act so the resolution is not an unwrapped state update.
    await act(async () => {
      release();
    });
  });

  it('rolls back to the previous stage when the server refuses', async () => {
    respondWith(403, {
      error: { code: 'FORBIDDEN', message: 'You can only change listings you posted.' },
    });

    render(<ApplicantStatusSelect applicationId="app-7" status="APPLIED" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'SHORTLISTED');

    // The control must never display a stage the server rejected.
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('APPLIED'));
  });

  it('surfaces the server’s own reason, not a guess about the network', async () => {
    respondWith(403, {
      error: { code: 'FORBIDDEN', message: 'You can only change listings you posted.' },
    });

    render(<ApplicantStatusSelect applicationId="app-7" status="APPLIED" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'SHORTLISTED');

    const message = await screen.findByText(/You can only change listings you posted/);
    // ...and says what is still true, since the control just moved back.
    expect(message).toHaveTextContent(/still showing as applied/i);
  });

  it('falls back to a connection message only for a genuine transport failure', async () => {
    failTransport();

    render(<ApplicantStatusSelect applicationId="app-7" status="REVIEWED" />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'REJECTED');

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
  });

  it('offers every stage and labels the control for screen readers', () => {
    respondWith(200, { data: {} });
    render(<ApplicantStatusSelect applicationId="app-7" status="APPLIED" />);

    expect(screen.getByLabelText(/move to/i)).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Applied',
      'Reviewed',
      'Shortlisted',
      'Rejected',
    ]);
  });
});
