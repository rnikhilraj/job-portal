import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { JobForm } from '@/components/job-form';
import type { PublicJob } from '@/modules/jobs/job.constants';

/**
 * One form serves both posting and editing, and the two differ only by whether
 * a `job` prop is present. These pin the parts that are easy to get wrong when
 * a component is shared like that: which verb it sends, which URL it sends to,
 * and that a failed save never navigates away from unsaved work.
 */
const push = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

type Recorded = { url: string; method?: string; body: unknown };
let requests: Recorded[] = [];

/*
 * jsdom has no global Response. Constructing one here throws a ReferenceError
 * that apiFetch reports as a transport failure, which would quietly turn these
 * tests green against the wrong branch — so the stub is a plain object.
 */
function respondWith(status: number, payload: unknown): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return { status, ok: status >= 200 && status < 300, json: async () => payload };
  }) as unknown as typeof fetch;
}

/** A transport-level failure: fetch itself rejects, as it does when offline. */
function respondWithNetworkFailure(): void {
  global.fetch = jest.fn(async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
}

const existingJob: PublicJob = {
  id: 'job-1',
  title: 'Staff Engineer',
  description: 'Own the platform end to end, and mentor the team around you.',
  location: 'Bengaluru',
  jobType: 'FULL_TIME',
  status: 'OPEN',
  postedBy: 'hr-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText(/title/i), 'Platform Engineer');
  await userEvent.type(
    screen.getByLabelText(/description/i),
    'Build and run the deployment platform the product teams depend on.',
  );
  await userEvent.type(screen.getByLabelText(/location/i), 'Remote');
}

beforeEach(() => {
  requests = [];
  push.mockReset();
  refresh.mockReset();
  respondWith(201, { data: existingJob });
});

describe('JobForm — posting a new listing', () => {
  it('POSTs the parsed listing and returns to the listings page', async () => {
    render(<JobForm />);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.url).toBe('/api/jobs');
    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.body).toMatchObject({
      title: 'Platform Engineer',
      location: 'Remote',
      jobType: 'FULL_TIME',
      status: 'OPEN',
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/hr/jobs'));
    expect(refresh).toHaveBeenCalled();
  });

  it('defaults to a full-time, open role without the user choosing', async () => {
    render(<JobForm />);
    expect(screen.getByLabelText(/job type/i)).toHaveValue('FULL_TIME');
    expect(screen.getByLabelText(/status/i)).toHaveValue('OPEN');
  });

  it('sends the type and status the user picked', async () => {
    render(<JobForm />);
    await fillValidForm();
    await userEvent.selectOptions(screen.getByLabelText(/job type/i), 'CONTRACT');
    await userEvent.selectOptions(screen.getByLabelText(/status/i), 'CLOSED');
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body).toMatchObject({ jobType: 'CONTRACT', status: 'CLOSED' });
  });
});

describe('JobForm — editing an existing listing', () => {
  it('prefills every field from the job it was given', () => {
    render(<JobForm job={existingJob} />);

    expect(screen.getByLabelText(/title/i)).toHaveValue('Staff Engineer');
    expect(screen.getByLabelText(/description/i)).toHaveValue(existingJob.description);
    expect(screen.getByLabelText(/location/i)).toHaveValue('Bengaluru');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /post this role/i })).not.toBeInTheDocument();
  });

  it('PATCHes the specific listing rather than creating a second one', async () => {
    respondWith(200, { data: existingJob });
    render(<JobForm job={existingJob} />);

    await userEvent.clear(screen.getByLabelText(/title/i));
    await userEvent.type(screen.getByLabelText(/title/i), 'Principal Engineer');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.url).toBe('/api/jobs/job-1');
    expect(requests[0]?.method).toBe('PATCH');
    expect(requests[0]?.body).toMatchObject({ title: 'Principal Engineer' });
  });
});

describe('JobForm — validation before anything is sent', () => {
  it('reports a too-short title and makes no request', async () => {
    render(<JobForm />);
    await userEvent.type(screen.getByLabelText(/title/i), 'no');
    await userEvent.type(screen.getByLabelText(/description/i), 'x'.repeat(30));
    await userEvent.type(screen.getByLabelText(/location/i), 'Remote');
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it('replaces the description hint with the error, rather than showing both', async () => {
    render(<JobForm />);
    expect(screen.getByText(/beats a list of adjectives/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/title/i), 'Platform Engineer');
    await userEvent.type(screen.getByLabelText(/description/i), 'too short');
    await userEvent.type(screen.getByLabelText(/location/i), 'Remote');
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    expect(await screen.findByText(/more than 20 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/beats a list of adjectives/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears earlier field errors once the input is fixed', async () => {
    render(<JobForm />);
    await userEvent.type(screen.getByLabelText(/title/i), 'no');
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));
    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/title/i), 'w a proper title');
    await userEvent.type(
      screen.getByLabelText(/description/i),
      'A description comfortably past the twenty character floor.',
    );
    await userEvent.type(screen.getByLabelText(/location/i), 'Remote');
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByText(/at least 3 characters/i)).not.toBeInTheDocument();
  });
});

describe('JobForm — when the server refuses', () => {
  it('surfaces per-field messages from a 400 and stays on the form', async () => {
    respondWith(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some of those fields need another look.',
        details: { title: ['That title is already taken.'] },
      },
    });
    render(<JobForm />);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    expect(await screen.findByText('That title is already taken.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Some of those fields need another look.');
    expect(push).not.toHaveBeenCalled();
  });

  it('distinguishes an unreachable server from a rejected request', async () => {
    respondWithNetworkFailure();
    render(<JobForm />);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
    expect(push).not.toHaveBeenCalled();
  });

  it('re-enables the submit button so the work is not stranded', async () => {
    respondWith(500, {
      error: { code: 'INTERNAL_ERROR', message: 'Something broke on our side.' },
    });
    render(<JobForm />);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /post this role/i }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /post this role/i })).toBeEnabled();
  });
});

describe('JobForm — leaving', () => {
  it('cancels back to the listings page without sending anything', async () => {
    render(<JobForm />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Half-written role');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(push).toHaveBeenCalledWith('/hr/jobs');
    expect(requests).toHaveLength(0);
  });
});
