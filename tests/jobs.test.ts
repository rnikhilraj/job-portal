import { GET as listJobs, POST as postJob } from '@/app/api/jobs/route';
import { DELETE as deleteJob, GET as getJob, PATCH as patchJob } from '@/app/api/jobs/[id]/route';
import { Job, type PublicJob } from '@/modules/jobs/job.model';

import { createCandidate, createHr } from './helpers/auth';
import { createJobFor, validJobPayload } from './helpers/factories';
import {
  jsonRequest,
  readJson,
  routeContext,
  type ApiData,
  type ApiError,
} from './helpers/request';

const noParams = routeContext({});

describe('POST /api/jobs', () => {
  it('lets an HR user create a listing owned by them', async () => {
    const hr = await createHr();

    const response = await postJob(
      jsonRequest('/api/jobs', { method: 'POST', body: validJobPayload, cookie: hr.cookie }),
      noParams,
    );

    expect(response.status).toBe(201);
    const body = await readJson<ApiData<PublicJob>>(response);
    expect(body.data).toMatchObject({ title: validJobPayload.title, status: 'OPEN' });
    expect(body.data.postedBy).toBe(hr.id);
  });

  it('rejects a candidate with 403', async () => {
    const candidate = await createCandidate();

    const response = await postJob(
      jsonRequest('/api/jobs', {
        method: 'POST',
        body: validJobPayload,
        cookie: candidate.cookie,
      }),
      noParams,
    );

    expect(response.status).toBe(403);
    expect((await readJson<ApiError>(response)).error.code).toBe('FORBIDDEN');
    expect(await Job.countDocuments()).toBe(0);
  });

  it('rejects an anonymous request with 401', async () => {
    const response = await postJob(
      jsonRequest('/api/jobs', { method: 'POST', body: validJobPayload }),
      noParams,
    );

    expect(response.status).toBe(401);
  });

  it('returns 400 with field details for invalid input', async () => {
    const hr = await createHr();

    const response = await postJob(
      jsonRequest('/api/jobs', {
        method: 'POST',
        body: { title: 'x', description: 'too short', location: '', jobType: 'PERMANENT' },
        cookie: hr.cookie,
      }),
      noParams,
    );

    expect(response.status).toBe(400);
    const details = (await readJson<ApiError>(response)).error.details as Record<string, string[]>;
    expect(Object.keys(details)).toEqual(
      expect.arrayContaining(['title', 'description', 'location', 'jobType']),
    );
  });
});

describe('GET /api/jobs?scope=mine', () => {
  it('returns only the calling HR user’s listings, including closed ones', async () => {
    const [owner, otherHr] = await Promise.all([createHr(), createHr()]);
    await createJobFor(owner.id, { title: 'Owned Open' });
    await createJobFor(owner.id, { title: 'Owned Closed', status: 'CLOSED' });
    await createJobFor(otherHr.id, { title: 'Someone Else' });

    const response = await listJobs(
      jsonRequest('/api/jobs?scope=mine', { cookie: owner.cookie }),
      noParams,
    );

    expect(response.status).toBe(200);
    const body = await readJson<ApiData<PublicJob[]>>(response);
    expect(body.data.map((job) => job.title).sort()).toEqual(['Owned Closed', 'Owned Open']);
    expect(body.meta?.total).toBe(2);
  });

  it('filters by status and searches by title', async () => {
    const owner = await createHr();
    await createJobFor(owner.id, { title: 'React Engineer' });
    await createJobFor(owner.id, { title: 'React Engineer (archived)', status: 'CLOSED' });
    await createJobFor(owner.id, { title: 'Data Analyst' });

    const byStatus = await listJobs(
      jsonRequest('/api/jobs?scope=mine&status=CLOSED', { cookie: owner.cookie }),
      noParams,
    );
    expect((await readJson<ApiData<PublicJob[]>>(byStatus)).data).toHaveLength(1);

    const byTitle = await listJobs(
      jsonRequest('/api/jobs?scope=mine&q=react', { cookie: owner.cookie }),
      noParams,
    );
    expect((await readJson<ApiData<PublicJob[]>>(byTitle)).data).toHaveLength(2);
  });

  it('rejects a candidate asking for the HR scope with 403', async () => {
    const candidate = await createCandidate();

    const response = await listJobs(
      jsonRequest('/api/jobs?scope=mine', { cookie: candidate.cookie }),
      noParams,
    );

    expect(response.status).toBe(403);
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns an open listing to a candidate', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    const response = await getJob(
      jsonRequest(`/api/jobs/${job._id}`, { cookie: candidate.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(200);
    expect((await readJson<ApiData<PublicJob>>(response)).data.id).toBe(String(job._id));
  });

  it('hides a closed listing from candidates but shows it to its owner', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id, { status: 'CLOSED' });
    const context = routeContext({ id: String(job._id) });

    const asCandidate = await getJob(
      jsonRequest(`/api/jobs/${job._id}`, { cookie: candidate.cookie }),
      context,
    );
    expect(asCandidate.status).toBe(404);

    const asOwner = await getJob(
      jsonRequest(`/api/jobs/${job._id}`, { cookie: hr.cookie }),
      routeContext({ id: String(job._id) }),
    );
    expect(asOwner.status).toBe(200);
  });

  it('returns 400 for a malformed id rather than a server error', async () => {
    const candidate = await createCandidate();

    const response = await getJob(
      jsonRequest('/api/jobs/not-an-id', { cookie: candidate.cookie }),
      routeContext({ id: 'not-an-id' }),
    );

    expect(response.status).toBe(400);
  });

  it('returns 404 for an id that does not exist', async () => {
    const candidate = await createCandidate();
    const missingId = '000000000000000000000000';

    const response = await getJob(
      jsonRequest(`/api/jobs/${missingId}`, { cookie: candidate.cookie }),
      routeContext({ id: missingId }),
    );

    expect(response.status).toBe(404);
  });
});

describe('ownership enforcement on PATCH and DELETE /api/jobs/:id', () => {
  it('lets the owner update their listing', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const response = await patchJob(
      jsonRequest(`/api/jobs/${job._id}`, {
        method: 'PATCH',
        body: { title: 'Updated title', status: 'CLOSED' },
        cookie: hr.cookie,
      }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(200);
    const body = await readJson<ApiData<PublicJob>>(response);
    expect(body.data).toMatchObject({ title: 'Updated title', status: 'CLOSED' });
  });

  it('stops one HR user from editing another HR user’s listing', async () => {
    const [owner, intruder] = await Promise.all([createHr(), createHr()]);
    const job = await createJobFor(owner.id, { title: 'Original' });

    const response = await patchJob(
      jsonRequest(`/api/jobs/${job._id}`, {
        method: 'PATCH',
        body: { title: 'Hijacked' },
        cookie: intruder.cookie,
      }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(403);
    expect((await readJson<ApiError>(response)).error.code).toBe('FORBIDDEN');
    expect((await Job.findById(job._id))?.title).toBe('Original');
  });

  it('stops one HR user from deleting another HR user’s listing', async () => {
    const [owner, intruder] = await Promise.all([createHr(), createHr()]);
    const job = await createJobFor(owner.id);

    const response = await deleteJob(
      jsonRequest(`/api/jobs/${job._id}`, { method: 'DELETE', cookie: intruder.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(403);
    expect(await Job.countDocuments({ _id: job._id })).toBe(1);
  });

  it('stops a candidate from editing or deleting any listing', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);
    const id = String(job._id);

    const patched = await patchJob(
      jsonRequest(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: { title: 'Nope' },
        cookie: candidate.cookie,
      }),
      routeContext({ id }),
    );
    const deleted = await deleteJob(
      jsonRequest(`/api/jobs/${id}`, { method: 'DELETE', cookie: candidate.cookie }),
      routeContext({ id }),
    );

    expect(patched.status).toBe(403);
    expect(deleted.status).toBe(403);
    expect(await Job.countDocuments({ _id: id })).toBe(1);
  });

  it('lets the owner delete their listing', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const response = await deleteJob(
      jsonRequest(`/api/jobs/${job._id}`, { method: 'DELETE', cookie: hr.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(204);
    expect(await Job.countDocuments({ _id: job._id })).toBe(0);
  });

  it('rejects an empty update body with 400', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const response = await patchJob(
      jsonRequest(`/api/jobs/${job._id}`, { method: 'PATCH', body: {}, cookie: hr.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(400);
  });
});
