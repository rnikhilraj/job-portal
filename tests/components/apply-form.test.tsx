import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplyForm } from '@/components/apply-form';

/**
 * The apply form's client-side checks are a courtesy — the server repeats every
 * one of them and inspects the file's actual bytes. These tests therefore pin
 * two things: that the courtesy checks behave, and that nothing here is load
 * bearing, i.e. a rejected file never reaches the network.
 */
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: jest.fn() }),
}));

const MAX_BYTES = 1024 * 1024;
let requests: Array<{ url: string; body: FormData }> = [];

function respondWith(status: number, payload: unknown): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: init?.body as FormData });
    return { status, ok: status >= 200 && status < 300, json: async () => payload };
  }) as unknown as typeof fetch;
}

function pdf(name = 'cv.pdf', bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}

async function attach(file: File, { bypassAccept = false } = {}): Promise<void> {
  // The input carries accept="application/pdf", and userEvent honours it — so a
  // non-PDF is refused by the browser before any of our code runs. Bypassing it
  // is what exercises the component's own type check, which exists for the
  // drag-and-drop and programmatic paths where accept does not apply.
  await userEvent.upload(screen.getByLabelText(/resume/i), file, {
    applyAccept: !bypassAccept,
  });
}

beforeEach(() => {
  requests = [];
  push.mockReset();
  respondWith(201, { data: { id: 'a1' } });
});

describe('ApplyForm — submitting', () => {
  it('sends the file as multipart and redirects to the tracker', async () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.url).toBe('/api/jobs/job-1/applications');
    expect(requests[0]?.body).toBeInstanceOf(FormData);
    expect((requests[0]?.body.get('resume') as File).name).toBe('cv.pdf');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/applications'));
  });

  it('includes a cover note when one is written, and omits it when not', async () => {
    const { unmount } = render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);
    await attach(pdf());
    await userEvent.type(screen.getByLabelText(/cover note/i), 'Keen to join.');
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body.get('coverNote')).toBe('Keen to join.');

    unmount();
    requests = [];

    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);
    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.body.get('coverNote')).toBeNull();
  });
});

describe('ApplyForm — the client-side courtesy checks', () => {
  it('refuses to submit with no file attached, without calling the API', async () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));

    expect(await screen.findByText(/pick a pdf/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('has accept="application/pdf" so the browser filters non-PDFs first', () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);
    expect(screen.getByLabelText(/resume/i)).toHaveAttribute(
      'accept',
      'application/pdf,.pdf',
    );
  });

  it('rejects a non-PDF that gets past accept, before it reaches the network', async () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await attach(new File(['x'], 'notes.txt', { type: 'text/plain' }), {
      bypassAccept: true,
    });
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));

    expect(await screen.findByText(/only pdf/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('rejects a file over the configured limit, quoting the limit', async () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await attach(pdf('huge.pdf', MAX_BYTES + 1));
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));

    expect(await screen.findByText(/1 mb or smaller/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('names the attached file back to the reader once chosen', async () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    expect(screen.getByText(/pdf only, up to 1 mb/i)).toBeInTheDocument();
    await attach(pdf('Ada CV.pdf'));
    expect(await screen.findByText(/Ada CV\.pdf — looks good/i)).toBeInTheDocument();
  });

  it('counts the cover note only once something is typed', async () => {
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    expect(screen.getByText(/a few honest sentences/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/cover note/i), 'Hello');
    expect(screen.getByText(/5 of 2000 characters/i)).toBeInTheDocument();
  });
});

describe('ApplyForm — when the server refuses', () => {
  it('surfaces the server’s message, such as a duplicate application', async () => {
    respondWith(409, {
      error: { code: 'CONFLICT', message: 'You have already applied to this job.' },
    });
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));

    expect(await screen.findByText(/already applied to this job/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('renders per-field detail from a validation failure', async () => {
    respondWith(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some of those fields need another look.',
        details: { coverNote: ['Trim the cover note to 2000 characters.'] },
      },
    });
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /send my application/i }));

    expect(await screen.findByText(/trim the cover note/i)).toBeInTheDocument();
  });

  it('re-enables the button after a failure so the attempt can be retried', async () => {
    respondWith(500, { error: { code: 'INTERNAL_ERROR', message: 'Something broke.' } });
    render(<ApplyForm jobId="job-1" maxResumeBytes={MAX_BYTES} />);

    await attach(pdf());
    const submit = screen.getByRole('button', { name: /send my application/i });
    await userEvent.click(submit);

    await waitFor(() => expect(submit).not.toBeDisabled());
  });
});
