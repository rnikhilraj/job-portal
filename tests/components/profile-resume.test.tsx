import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProfileResume } from '@/components/profile-resume';
import type { ResumeSummary } from '@/modules/users/user.constants';

/**
 * The profile resume card. Its client-side checks mirror the server's and are
 * a courtesy, not a control — so these pin that a rejected file never reaches
 * the network, and that the copy tells the truth about who can read the file in
 * each visibility state.
 */
const MAX_BYTES = 1024 * 1024;

type Recorded = { url: string; method?: string; body: unknown };
let requests: Recorded[] = [];

function respondWith(status: number, payload: unknown): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method, body: init?.body });
    return { status, ok: status >= 200 && status < 300, json: async () => payload };
  }) as unknown as typeof fetch;
}

const resume: ResumeSummary = { originalName: 'sam-rivera-cv.pdf', sizeBytes: 240 * 1024 };

function pdf(name = 'cv.pdf', bytes = 2048): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}

async function attach(file: File, { bypassAccept = false } = {}): Promise<void> {
  // The input carries accept="application/pdf", which userEvent honours, so a
  // non-PDF never reaches the component's own check unless accept is bypassed.
  await userEvent.upload(screen.getByLabelText(/resume/i), file, {
    applyAccept: !bypassAccept,
  });
}

beforeEach(() => {
  requests = [];
  respondWith(200, { data: { resume } });
});

describe('ProfileResume — uploading', () => {
  it('PUTs the file as multipart and shows the stored name', async () => {
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);
    expect(screen.getByText(/nothing uploaded yet/i)).toBeInTheDocument();

    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.url).toBe('/api/users/me/resume');
    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.body).toBeInstanceOf(FormData);
    expect((requests[0]?.body as FormData).get('resume')).toBeInstanceOf(File);

    expect(await screen.findByText('sam-rivera-cv.pdf')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/uploaded/i);
  });

  it('calls the swap action by its name once a resume exists', async () => {
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    expect(screen.getByLabelText(/replace resume/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /swap it out/i })).toBeInTheDocument();
  });

  it('refuses to submit with no file chosen, without a request', async () => {
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/pick a file first/i);
    expect(requests).toHaveLength(0);
  });

  it('rejects a non-PDF locally, so nothing is sent', async () => {
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    const notAPdf = new File([new Uint8Array(16)], 'notes.txt', { type: 'text/plain' });
    await attach(notAPdf, { bypassAccept: true });
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/only pdf resumes/i);
    expect(requests).toHaveLength(0);
  });

  it('rejects an oversized file locally, quoting the limit', async () => {
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await attach(pdf('huge.pdf', MAX_BYTES + 1));
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/1 MB or smaller/i);
    expect(requests).toHaveLength(0);
  });

  it('reports the server’s own reason when it refuses', async () => {
    respondWith(400, {
      error: { code: 'VALIDATION_ERROR', message: 'That file is not a valid PDF.' },
    });
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That file is not a valid PDF.');
  });

  it('distinguishes an unreachable server from a refusal', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await attach(pdf());
    await userEvent.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/was not uploaded/i);
  });
});

describe('ProfileResume — removing', () => {
  it('asks first, and does nothing if the confirmation is declined', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(requests).toHaveLength(0);
    expect(screen.getByText('sam-rivera-cv.pdf')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('DELETEs once confirmed and falls back to the empty state', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    respondWith(200, { data: { resume: null } });
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.method).toBe('DELETE');
    expect(await screen.findByText(/nothing to download now/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing uploaded yet/i)).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('says the file is still in place when the delete fails to reach the server', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    global.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/still in place/i);
    confirmSpy.mockRestore();
  });
});

describe('ProfileResume — what it tells the candidate about visibility', () => {
  it('says the file is private while the profile is not discoverable', () => {
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    expect(screen.getByText(/this is private right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/recruiters can download this/i)).not.toBeInTheDocument();
  });

  it('warns that recruiters can download it once the profile is discoverable', () => {
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable />);

    expect(screen.getByText(/recruiters can download this/i)).toBeInTheDocument();
    expect(screen.queryByText(/this is private right now/i)).not.toBeInTheDocument();
  });

  it('links the file to the authorized handler, never a public path', () => {
    render(<ProfileResume resume={resume} maxResumeBytes={MAX_BYTES} isSearchable={false} />);

    expect(screen.getByRole('link', { name: 'sam-rivera-cv.pdf' })).toHaveAttribute(
      'href',
      '/api/users/me/resume',
    );
  });

  it('states the size limit up front', () => {
    render(<ProfileResume resume={null} maxResumeBytes={MAX_BYTES} isSearchable={false} />);
    expect(screen.getByText(/pdf only, up to 1 MB/i)).toBeInTheDocument();
  });
});
