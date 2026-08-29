import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { JobCard } from '@/components/job-card';
import { MetaRow, PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { SkeletonCard, SkeletonLine, SkeletonList } from '@/components/skeleton';
import { TextField } from '@/components/text-field';
import type { PublicJob } from '@/modules/jobs/job.constants';

/**
 * The presentational layer. These are small, but three of them carry the
 * accessibility guarantees the rest of the app leans on — field errors being
 * announced, pagination being navigable, and loading states not reading as a
 * wall of empty boxes — so they are worth pinning rather than eyeballing.
 */
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

describe('Alert', () => {
  it.each(['error', 'success', 'info'] as const)('renders %s content in an alert role', (tone) => {
    render(<Alert tone={tone}>Something to say</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something to say');
  });

  it('carries a glyph so tone is not conveyed by colour alone', () => {
    const { container } = render(<Alert tone="error">Nope</Alert>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('TextField', () => {
  it('associates its label with the input', () => {
    render(<TextField label="Full name" name="name" value="Ada" onChange={() => {}} />);
    expect(screen.getByLabelText('Full name')).toHaveValue('Ada');
  });

  it('reports every keystroke to the caller', async () => {
    const onChange = jest.fn();
    render(<TextField label="Email" name="email" value="" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Email'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('shows the hint until there is an error to show instead', () => {
    const { rerender } = render(
      <TextField label="Phone" name="phone" value="" onChange={() => {}} hint="Optional" />,
    );
    expect(screen.getByText('Optional')).toBeInTheDocument();

    rerender(
      <TextField
        label="Phone"
        name="phone"
        value=""
        onChange={() => {}}
        hint="Optional"
        errors={['Digits only, please.']}
      />,
    );
    expect(screen.queryByText('Optional')).not.toBeInTheDocument();
    expect(screen.getByText('Digits only, please.')).toBeInTheDocument();
  });

  it('marks the input invalid and points at the message for assistive tech', () => {
    render(
      <TextField label="Email" name="email" value="" onChange={() => {}} errors={['Bad email']} />,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(document.getElementById('email-error')).toHaveTextContent('Bad email');
  });
});

describe('EmptyState', () => {
  it('reads as an invitation: a heading, an explanation and a way forward', () => {
    render(
      <EmptyState
        title="Nothing in flight yet"
        description="Apply to something and it lands here."
        action={{ href: '/jobs', label: 'Find something' }}
        secondary={{ href: '/profile', label: 'Sort my profile' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Nothing in flight yet' })).toBeInTheDocument();
    expect(screen.getByText(/apply to something/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find something' })).toHaveAttribute('href', '/jobs');
    expect(screen.getByRole('link', { name: 'Sort my profile' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('works with no actions at all', () => {
    render(<EmptyState title="Quiet so far" description="Nobody has applied yet." />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  const buildHref = (page: number) => `/jobs?page=${page}`;

  it('renders nothing when there are no results to page through', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={0} buildHref={buildHref} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('states position and total, and offers only the directions that exist', () => {
    render(<Pagination page={1} totalPages={3} total={7} buildHref={buildHref} />);

    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute('href', '/jobs?page=2');
    // Previous exists visually but must not be a link on the first page.
    expect(screen.queryByRole('link', { name: /previous/i })).not.toBeInTheDocument();
  });

  it('offers only Previous on the last page', () => {
    render(<Pagination page={3} totalPages={3} total={7} buildHref={buildHref} />);

    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute('href', '/jobs?page=2');
    expect(screen.queryByRole('link', { name: /next/i })).not.toBeInTheDocument();
  });

  it('singularises a lone result', () => {
    render(<Pagination page={1} totalPages={1} total={1} buildHref={buildHref} />);
    expect(screen.getByText(/1 result$/)).toBeInTheDocument();
  });
});

describe('PageHeader and MetaRow', () => {
  it('renders eyebrow, title, lede and an action slot', () => {
    render(
      <PageHeader
        eyebrow="Your pipeline"
        title="My applications"
        lede="Where each one stands."
        action={<button type="button">Post a job</button>}
      />,
    );

    expect(screen.getByText('Your pipeline')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My applications' })).toBeInTheDocument();
    expect(screen.getByText('Where each one stands.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post a job' })).toBeInTheDocument();
  });

  it('works with only the required parts', () => {
    render(<PageHeader eyebrow="Browse" title="Open roles" />);
    expect(screen.getByRole('heading', { name: 'Open roles' })).toBeInTheDocument();
  });

  it('lists each meta item with its glyph hidden from screen readers', () => {
    const { container } = render(
      <MetaRow items={[{ glyph: '◎', label: 'Remote' }, { glyph: '◈', label: 'Full time' }]} />,
    );

    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByText('Full time')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});

describe('JobCard', () => {
  const job: PublicJob = {
    id: 'job-1',
    title: 'Senior Backend Engineer',
    description: 'x'.repeat(400),
    location: 'Bengaluru',
    jobType: 'FULL_TIME',
    status: 'OPEN',
    postedBy: 'hr-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  it('links to the detail page and shows the human job type', () => {
    render(<JobCard job={job} />);

    expect(screen.getByRole('heading', { name: job.title })).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/jobs/job-1');
    expect(screen.getByText(/Full time/)).toBeInTheDocument();
  });

  it('truncates a long description rather than printing all of it', () => {
    render(<JobCard job={job} />);
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });

  it('leaves a short description intact', () => {
    render(<JobCard job={{ ...job, description: 'Short and sweet.' }} />);
    expect(screen.getByText('Short and sweet.')).toBeInTheDocument();
  });
});

describe('SkeletonList', () => {
  it('announces loading once, and hides the placeholder boxes', () => {
    const { container } = render(<SkeletonList label="Loading open positions…" rows={3} />);

    // One polite message, rather than a screen reader reading three empty cards.
    expect(screen.getByRole('status')).toHaveTextContent('Loading open positions…');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
  });
});

describe('Skeleton', () => {
  it('hides the placeholder boxes from screen readers', () => {
    const { container } = render(<SkeletonCard />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    // Five bars mirroring a job card's shape, so the page does not reflow.
    expect(container.querySelectorAll('span')).toHaveLength(5);
  });

  it('animates a bare line and passes size classes through', () => {
    const { container } = render(<SkeletonLine className="h-5 w-1/2" />);
    const line = container.firstElementChild as HTMLElement;

    expect(line).toHaveClass('animate-pulse', 'h-5', 'w-1/2');
  });

  it('renders as many rows as asked for', () => {
    const { container } = render(<SkeletonList label="Loading jobs" rows={4} />);

    expect(container.querySelectorAll('li')).toHaveLength(4);
  });
});
