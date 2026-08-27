import { GET as listJobs } from '@/app/api/jobs/route';
import type { PublicJob } from '@/modules/jobs/job.model';

import { createCandidate, createHr } from './helpers/auth';
import { createJobFor } from './helpers/factories';
import { jsonRequest, readJson, routeContext, type ApiData } from './helpers/request';

const noParams = routeContext({});

async function browse(cookie: string, query: string) {
  const response = await listJobs(jsonRequest(`/api/jobs${query}`, { cookie }), noParams);
  const body = await readJson<ApiData<PublicJob[]>>(response);
  return { status: response.status, titles: body.data.map((job) => job.title), meta: body.meta };
}

describe('GET /api/jobs (candidate browsing)', () => {
  it('requires authentication', async () => {
    const response = await listJobs(jsonRequest('/api/jobs'), noParams);
    expect(response.status).toBe(401);
  });

  it('returns only OPEN listings, newest first', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();

    await createJobFor(hr.id, { title: 'Older Open' });
    await createJobFor(hr.id, { title: 'Filled Role', status: 'CLOSED' });
    await createJobFor(hr.id, { title: 'Newer Open' });

    const { titles, meta } = await browse(candidate.cookie, '');

    expect(titles).toEqual(['Newer Open', 'Older Open']);
    expect(meta?.total).toBe(2);
  });

  it('searches the title and the description', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();

    await createJobFor(hr.id, { title: 'Kubernetes Engineer', description: 'Operate clusters at scale for our teams.' });
    await createJobFor(hr.id, { title: 'Product Designer', description: 'You will work closely with kubernetes platform teams.' });
    await createJobFor(hr.id, { title: 'Accountant', description: 'Manage the monthly financial close and reporting.' });

    const { titles } = await browse(candidate.cookie, '?q=kubernetes');

    expect(titles.sort()).toEqual(['Kubernetes Engineer', 'Product Designer']);
  });

  it('matches case-insensitively', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    await createJobFor(hr.id, { title: 'Senior GoLang Developer' });

    expect((await browse(candidate.cookie, '?q=golang')).titles).toEqual([
      'Senior GoLang Developer',
    ]);
  });

  it('treats regex metacharacters in the search term as literal text', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();

    await createJobFor(hr.id, { title: 'C++ Systems Engineer' });
    await createJobFor(hr.id, { title: 'Python Engineer' });

    // As a pattern `.*` would match everything; escaped, it matches nothing.
    expect((await browse(candidate.cookie, '?q=.*')).titles).toEqual([]);
    // A literal `++` should still find the C++ listing.
    expect((await browse(candidate.cookie, '?q=C%2B%2B')).titles).toEqual([
      'C++ Systems Engineer',
    ]);
  });

  it('filters by location and job type, and combines them with the keyword', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();

    await createJobFor(hr.id, { title: 'Remote React Dev', location: 'Remote (India)', jobType: 'REMOTE' });
    await createJobFor(hr.id, { title: 'Onsite React Dev', location: 'Bengaluru', jobType: 'FULL_TIME' });
    await createJobFor(hr.id, { title: 'Remote Data Intern', location: 'Remote (India)', jobType: 'INTERNSHIP' });

    expect((await browse(candidate.cookie, '?location=remote')).titles.sort()).toEqual([
      'Remote Data Intern',
      'Remote React Dev',
    ]);
    expect((await browse(candidate.cookie, '?jobType=INTERNSHIP')).titles).toEqual([
      'Remote Data Intern',
    ]);
    expect((await browse(candidate.cookie, '?location=remote&q=react')).titles).toEqual([
      'Remote React Dev',
    ]);
  });

  it('rejects an unknown job type with 400', async () => {
    const candidate = await createCandidate();
    const response = await listJobs(
      jsonRequest('/api/jobs?jobType=FREELANCE', { cookie: candidate.cookie }),
      noParams,
    );
    expect(response.status).toBe(400);
  });

  it('paginates and reports accurate metadata', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();

    for (let index = 0; index < 7; index += 1) {
      await createJobFor(hr.id, { title: `Role ${index}` });
    }

    const firstPage = await browse(candidate.cookie, '?limit=3&page=1');
    const lastPage = await browse(candidate.cookie, '?limit=3&page=3');
    const beyondEnd = await browse(candidate.cookie, '?limit=3&page=9');

    expect(firstPage.titles).toHaveLength(3);
    expect(firstPage.meta).toEqual({ page: 1, limit: 3, total: 7, totalPages: 3 });
    expect(lastPage.titles).toHaveLength(1);
    expect(beyondEnd.titles).toHaveLength(0);
  });

  it('refuses a page size above the cap instead of letting a client dump the table', async () => {
    const candidate = await createCandidate();
    const response = await listJobs(
      jsonRequest('/api/jobs?limit=5000', { cookie: candidate.cookie }),
      noParams,
    );
    expect(response.status).toBe(400);
  });
});
