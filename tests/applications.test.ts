import fs from 'node:fs/promises';

import { GET as listMine } from '@/app/api/applications/route';
import { PATCH as patchStatus } from '@/app/api/applications/[id]/route';
import {
  GET as listApplicants,
  POST as apply,
} from '@/app/api/jobs/[id]/applications/route';
import { DELETE as deleteJobRoute } from '@/app/api/jobs/[id]/route';
import { Application } from '@/modules/applications/application.model';
import { getEnv } from '@/lib/env';
import type {
  PublicApplicant,
  PublicApplication,
} from '@/modules/applications/application.service';

import { createCandidate, createHr } from './helpers/auth';
import { createJobFor } from './helpers/factories';
import { applicationForm, disguisedExecutable, pdfFile, plainTextFile } from './helpers/files';
import {
  formRequest,
  jsonRequest,
  readJson,
  routeContext,
  type ApiData,
  type ApiError,
} from './helpers/request';

const noParams = routeContext({});

async function uploadsDirEntries(): Promise<string[]> {
  return fs.readdir(getEnv().UPLOADS_DIR).catch(() => []);
}

function applyRequest(jobId: string, cookie: string, form: FormData) {
  return apply(
    formRequest(`/api/jobs/${jobId}/applications`, form, { cookie }),
    routeContext({ id: jobId }),
  );
}

describe('POST /api/jobs/:id/applications', () => {
  it('lets a candidate apply with a PDF and a cover note', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    const response = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile('My CV.pdf'), 'Keen to join the platform team.'),
    );

    expect(response.status).toBe(201);
    const body = await readJson<ApiData<PublicApplication>>(response);
    expect(body.data.status).toBe('APPLIED');
    expect(body.data.coverNote).toBe('Keen to join the platform team.');
    expect(body.data.job?.id).toBe(String(job._id));

    expect(await Application.countDocuments()).toBe(1);
    expect(await uploadsDirEntries()).toHaveLength(1);
  });

  it('applies successfully without a cover note', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    const response = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile()),
    );

    expect(response.status).toBe(201);
    expect((await readJson<ApiData<PublicApplication>>(response)).data.coverNote).toBeNull();
  });

  it('rejects a second application to the same job with 409', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    const first = await applyRequest(String(job._id), candidate.cookie, applicationForm(pdfFile()));
    const second = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile()),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect((await readJson<ApiError>(second)).error.code).toBe('CONFLICT');

    expect(await Application.countDocuments()).toBe(1);
    // The rejected attempt must not leave a stray file on the volume.
    expect(await uploadsDirEntries()).toHaveLength(1);
  });

  it('still allows the same candidate to apply to a different job', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const [jobA, jobB] = await Promise.all([createJobFor(hr.id), createJobFor(hr.id)]);

    expect(
      (await applyRequest(String(jobA._id), candidate.cookie, applicationForm(pdfFile()))).status,
    ).toBe(201);
    expect(
      (await applyRequest(String(jobB._id), candidate.cookie, applicationForm(pdfFile()))).status,
    ).toBe(201);
    expect(await Application.countDocuments()).toBe(2);
  });

  it('lets two different candidates apply to the same job', async () => {
    const hr = await createHr();
    const [first, second] = await Promise.all([createCandidate(), createCandidate()]);
    const job = await createJobFor(hr.id);

    expect(
      (await applyRequest(String(job._id), first.cookie, applicationForm(pdfFile()))).status,
    ).toBe(201);
    expect(
      (await applyRequest(String(job._id), second.cookie, applicationForm(pdfFile()))).status,
    ).toBe(201);
  });

  it('rejects an HR user trying to apply, with 403', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const response = await applyRequest(String(job._id), hr.cookie, applicationForm(pdfFile()));

    expect(response.status).toBe(403);
    expect(await Application.countDocuments()).toBe(0);
  });

  it('rejects an anonymous application with 401', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const response = await apply(
      formRequest(`/api/jobs/${job._id}/applications`, applicationForm(pdfFile())),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(401);
  });

  it('refuses to apply to a closed listing', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id, { status: 'CLOSED' });

    const response = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile()),
    );

    expect(response.status).toBe(404);
  });
});

describe('resume upload validation', () => {
  async function attempt(form: FormData) {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);
    return applyRequest(String(job._id), candidate.cookie, form);
  }

  it('requires a resume file', async () => {
    const response = await attempt(applicationForm(null, 'no file attached'));

    expect(response.status).toBe(400);
    expect((await readJson<ApiError>(response)).error.message).toMatch(/resume is required/i);
  });

  it('rejects a non-PDF content type', async () => {
    const response = await attempt(applicationForm(plainTextFile()));

    expect(response.status).toBe(400);
    expect((await readJson<ApiError>(response)).error.message).toMatch(/only pdf/i);
  });

  it('rejects a non-PDF file renamed to .pdf, because the bytes are checked', async () => {
    const response = await attempt(applicationForm(disguisedExecutable('resume.pdf')));

    expect(response.status).toBe(400);
    expect((await readJson<ApiError>(response)).error.message).toMatch(/not a valid pdf/i);
    expect(await Application.countDocuments()).toBe(0);
    expect(await uploadsDirEntries()).toHaveLength(0);
  });

  it('rejects an empty file', async () => {
    const empty = new File([new Uint8Array()], 'resume.pdf', { type: 'application/pdf' });
    const response = await attempt(applicationForm(empty));

    expect(response.status).toBe(400);
  });

  it('rejects a file above the configured size limit', async () => {
    const oversized = pdfFile('huge.pdf', getEnv().MAX_RESUME_BYTES + 1);
    const response = await attempt(applicationForm(oversized));

    expect(response.status).toBe(400);
    expect((await readJson<ApiError>(response)).error.message).toMatch(/or smaller/i);
    expect(await uploadsDirEntries()).toHaveLength(0);
  });

  it('rejects a cover note longer than the limit', async () => {
    const response = await attempt(applicationForm(pdfFile(), 'x'.repeat(2001)));

    expect(response.status).toBe(400);
    const details = (await readJson<ApiError>(response)).error.details as Record<string, string[]>;
    expect(details).toHaveProperty('coverNote');
  });

  it('never uses the client filename on disk, and neutralises a traversal attempt', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    const response = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile('../../../../etc/passwd.pdf')),
    );

    expect(response.status).toBe(201);

    const stored = await Application.findOne();
    // On disk: a server-generated UUID. In the database: a sanitised label.
    expect(stored?.resume.storedName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
    );
    expect(stored?.resume.originalName).toBe('passwd.pdf');

    const entries = await uploadsDirEntries();
    expect(entries).toEqual([stored?.resume.storedName]);
  });
});

describe('GET /api/applications (my applications)', () => {
  it('returns only the calling candidate’s applications', async () => {
    const hr = await createHr();
    const [mine, theirs] = await Promise.all([createCandidate(), createCandidate()]);
    const [jobA, jobB] = await Promise.all([
      createJobFor(hr.id, { title: 'Job A' }),
      createJobFor(hr.id, { title: 'Job B' }),
    ]);

    await applyRequest(String(jobA._id), mine.cookie, applicationForm(pdfFile()));
    await applyRequest(String(jobB._id), theirs.cookie, applicationForm(pdfFile()));

    const response = await listMine(jsonRequest('/api/applications', { cookie: mine.cookie }), noParams);
    const body = await readJson<ApiData<PublicApplication[]>>(response);

    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.job?.title).toBe('Job A');
  });

  it('filters by status and paginates', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();

    for (let index = 0; index < 3; index += 1) {
      const job = await createJobFor(hr.id, { title: `Job ${index}` });
      await applyRequest(String(job._id), candidate.cookie, applicationForm(pdfFile()));
    }
    await Application.updateOne({}, { status: 'SHORTLISTED' });

    const shortlisted = await listMine(
      jsonRequest('/api/applications?status=SHORTLISTED', { cookie: candidate.cookie }),
      noParams,
    );
    expect((await readJson<ApiData<PublicApplication[]>>(shortlisted)).data).toHaveLength(1);

    const paged = await listMine(
      jsonRequest('/api/applications?limit=2&page=2', { cookie: candidate.cookie }),
      noParams,
    );
    const body = await readJson<ApiData<PublicApplication[]>>(paged);
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('rejects an HR user with 403', async () => {
    const hr = await createHr();
    const response = await listMine(jsonRequest('/api/applications', { cookie: hr.cookie }), noParams);
    expect(response.status).toBe(403);
  });
});

describe('GET /api/jobs/:id/applications (applicants)', () => {
  async function seedApplicants() {
    const [owner, otherHr] = await Promise.all([createHr(), createHr()]);
    const job = await createJobFor(owner.id);

    const alice = await createCandidate({ name: 'Alice Kumar' });
    const bob = await createCandidate({ name: 'Bob Fernandes' });
    await applyRequest(String(job._id), alice.cookie, applicationForm(pdfFile()));
    await applyRequest(String(job._id), bob.cookie, applicationForm(pdfFile()));

    return { owner, otherHr, job, alice, bob };
  }

  function fetchApplicants(jobId: string, cookie: string, query = '') {
    return listApplicants(
      jsonRequest(`/api/jobs/${jobId}/applications${query}`, { cookie }),
      routeContext({ id: jobId }),
    );
  }

  it('returns applicants with their profile details to the owning HR user', async () => {
    const { owner, job } = await seedApplicants();

    const response = await fetchApplicants(String(job._id), owner.cookie);
    const body = await readJson<ApiData<PublicApplicant[]>>(response);

    expect(response.status).toBe(200);
    expect(body.data.map((applicant) => applicant.candidate?.name).sort()).toEqual([
      'Alice Kumar',
      'Bob Fernandes',
    ]);
    expect(body.data[0]?.resume.originalName).toBe('resume.pdf');
  });

  it('searches applicants by name and filters by status', async () => {
    const { owner, job } = await seedApplicants();
    await Application.updateOne({}, { status: 'REJECTED' });

    const byName = await fetchApplicants(String(job._id), owner.cookie, '?q=alice');
    expect((await readJson<ApiData<PublicApplicant[]>>(byName)).data).toHaveLength(1);

    const byStatus = await fetchApplicants(String(job._id), owner.cookie, '?status=REJECTED');
    expect((await readJson<ApiData<PublicApplicant[]>>(byStatus)).data).toHaveLength(1);

    const noMatch = await fetchApplicants(String(job._id), owner.cookie, '?q=zzz');
    expect((await readJson<ApiData<PublicApplicant[]>>(noMatch)).data).toHaveLength(0);
  });

  it('stops another HR user from reading the applicant pipeline', async () => {
    const { otherHr, job } = await seedApplicants();

    const response = await fetchApplicants(String(job._id), otherHr.cookie);

    expect(response.status).toBe(403);
  });

  it('stops a candidate from reading the applicant list', async () => {
    const { alice, job } = await seedApplicants();

    const response = await fetchApplicants(String(job._id), alice.cookie);

    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/applications/:id (status changes)', () => {
  async function seedOneApplication() {
    const [owner, otherHr] = await Promise.all([createHr(), createHr()]);
    const candidate = await createCandidate();
    const job = await createJobFor(owner.id);

    const response = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile()),
    );
    const { data } = await readJson<ApiData<PublicApplication>>(response);

    return { owner, otherHr, candidate, job, applicationId: data.id };
  }

  function patch(applicationId: string, cookie: string, body: unknown) {
    return patchStatus(
      jsonRequest(`/api/applications/${applicationId}`, { method: 'PATCH', body, cookie }),
      routeContext({ id: applicationId }),
    );
  }

  it('lets the owning HR user move an applicant through the pipeline', async () => {
    const { owner, applicationId } = await seedOneApplication();

    for (const status of ['REVIEWED', 'SHORTLISTED', 'REJECTED'] as const) {
      const response = await patch(applicationId, owner.cookie, { status });
      expect(response.status).toBe(200);
      expect((await Application.findById(applicationId))?.status).toBe(status);
    }
  });

  it('stops another HR user from changing the status', async () => {
    const { otherHr, applicationId } = await seedOneApplication();

    const response = await patch(applicationId, otherHr.cookie, { status: 'SHORTLISTED' });

    expect(response.status).toBe(403);
    expect((await Application.findById(applicationId))?.status).toBe('APPLIED');
  });

  it('stops the candidate from changing their own status', async () => {
    const { candidate, applicationId } = await seedOneApplication();

    const response = await patch(applicationId, candidate.cookie, { status: 'SHORTLISTED' });

    expect(response.status).toBe(403);
    expect((await Application.findById(applicationId))?.status).toBe('APPLIED');
  });

  it('rejects an unknown status with 400', async () => {
    const { owner, applicationId } = await seedOneApplication();

    const response = await patch(applicationId, owner.cookie, { status: 'HIRED' });

    expect(response.status).toBe(400);
  });

  it('returns 404 for an application that does not exist', async () => {
    const { owner } = await seedOneApplication();

    const response = await patch('000000000000000000000000', owner.cookie, { status: 'REVIEWED' });

    expect(response.status).toBe(404);
  });
});

describe('deleting a job cascades to its applications', () => {
  it('removes the applications and their resume files', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    await applyRequest(String(job._id), candidate.cookie, applicationForm(pdfFile()));
    expect(await uploadsDirEntries()).toHaveLength(1);

    const response = await deleteJobRoute(
      jsonRequest(`/api/jobs/${job._id}`, { method: 'DELETE', cookie: hr.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(204);
    expect(await Application.countDocuments()).toBe(0);
    expect(await uploadsDirEntries()).toHaveLength(0);
  });
});

describe('countApplicantsByStatus (the pipeline funnel)', () => {
  it('counts each stage, and zero for stages nobody is at', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);
    const [a, b, c] = await Promise.all([
      createCandidate(),
      createCandidate(),
      createCandidate(),
    ]);

    for (const candidate of [a, b, c]) {
      await applyRequest(String(job._id), candidate.cookie, applicationForm(pdfFile()));
    }
    await Application.updateOne({ candidate: b.id }, { status: 'SHORTLISTED' });
    await Application.updateOne({ candidate: c.id }, { status: 'REJECTED' });

    const { countApplicantsByStatus } = await import(
      '@/modules/applications/application.service'
    );
    const { counts, total } = await countApplicantsByStatus(String(job._id), hr.user._id);

    expect(counts).toEqual({ APPLIED: 1, REVIEWED: 0, SHORTLISTED: 1, REJECTED: 1 });
    expect(total).toBe(3);
  });

  it('returns an all-zero funnel for a listing nobody has applied to', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const { countApplicantsByStatus } = await import(
      '@/modules/applications/application.service'
    );
    const { counts, total } = await countApplicantsByStatus(String(job._id), hr.user._id);

    expect(total).toBe(0);
    expect(counts).toEqual({ APPLIED: 0, REVIEWED: 0, SHORTLISTED: 0, REJECTED: 0 });
  });

  it('counts only this listing, never another one', async () => {
    const hr = await createHr();
    const [mine, other] = await Promise.all([createJobFor(hr.id), createJobFor(hr.id)]);
    const candidate = await createCandidate();

    await applyRequest(String(mine._id), candidate.cookie, applicationForm(pdfFile()));
    await applyRequest(String(other._id), candidate.cookie, applicationForm(pdfFile()));

    const { countApplicantsByStatus } = await import(
      '@/modules/applications/application.service'
    );

    expect((await countApplicantsByStatus(String(mine._id), hr.user._id)).total).toBe(1);
  });

  it('refuses to count another HR user’s pipeline', async () => {
    const [owner, intruder] = await Promise.all([createHr(), createHr()]);
    const job = await createJobFor(owner.id);

    const { countApplicantsByStatus } = await import(
      '@/modules/applications/application.service'
    );

    // Ownership is enforced here too, not just on the list beside it.
    await expect(
      countApplicantsByStatus(String(job._id), intruder.user._id),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('reports a missing listing as 404', async () => {
    const hr = await createHr();

    const { countApplicantsByStatus } = await import(
      '@/modules/applications/application.service'
    );

    await expect(
      countApplicantsByStatus('000000000000000000000000', hr.user._id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('POST /api/jobs/:id/applications is rate limited', () => {
  /*
   * The limiter runs before the duplicate check, so repeated posts to one
   * listing spend the allowance exactly as posts to twenty different listings
   * would. That is the point: the cost being bounded is the disk write, not the
   * successful application.
   */
  it('refuses the twenty-first application in the window with 429', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await applyRequest(
        String(job._id),
        candidate.cookie,
        applicationForm(pdfFile()),
      );
      // The first lands; the rest are duplicates. Neither outcome is a 429 yet.
      expect([201, 409]).toContain(response.status);
    }

    const response = await applyRequest(
      String(job._id),
      candidate.cookie,
      applicationForm(pdfFile()),
    );

    expect(response.status).toBe(429);
    expect((await readJson<ApiError>(response)).error.code).toBe('RATE_LIMITED');
  });

  it('meters each candidate separately', async () => {
    const hr = await createHr();
    const heavy = await createCandidate();
    const quiet = await createCandidate();
    const job = await createJobFor(hr.id);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await applyRequest(String(job._id), heavy.cookie, applicationForm(pdfFile()));
    }
    const blocked = await applyRequest(
      String(job._id),
      heavy.cookie,
      applicationForm(pdfFile()),
    );
    expect(blocked.status).toBe(429);

    const allowed = await applyRequest(
      String(job._id),
      quiet.cookie,
      applicationForm(pdfFile()),
    );
    expect(allowed.status).toBe(201);
  });

  it('leaves no file behind for a throttled request', async () => {
    const hr = await createHr();
    const candidate = await createCandidate();
    const job = await createJobFor(hr.id);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await applyRequest(String(job._id), candidate.cookie, applicationForm(pdfFile()));
    }
    // One successful application wrote one file; the 19 duplicates cleaned up
    // after themselves.
    expect(await uploadsDirEntries()).toHaveLength(1);

    await applyRequest(String(job._id), candidate.cookie, applicationForm(pdfFile()));

    // A 429 is refused before the body is read, so nothing reaches the volume.
    expect(await uploadsDirEntries()).toHaveLength(1);
  });

  it('does not spend the allowance on reading the applicant list', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await listApplicants(
        jsonRequest(`/api/jobs/${job._id}/applications`, { cookie: hr.cookie }),
        routeContext({ id: String(job._id) }),
      );
      expect(response.status).toBe(200);
    }
  });
});
