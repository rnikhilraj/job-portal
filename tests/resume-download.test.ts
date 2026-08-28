import { GET as downloadResume } from '@/app/api/applications/[id]/resume/route';
import { POST as apply } from '@/app/api/jobs/[id]/applications/route';
import { Application } from '@/modules/applications/application.model';
import { sanitizeOriginalName } from '@/lib/resume-storage';
import type { PublicApplication } from '@/modules/applications/application.service';

import { createCandidate, createHr } from './helpers/auth';
import { createJobFor } from './helpers/factories';
import { applicationForm, pdfBytes, pdfFile } from './helpers/files';
import {
  formRequest,
  jsonRequest,
  readJson,
  routeContext,
  type ApiData,
} from './helpers/request';

async function seedApplication(filename = 'my-cv.pdf') {
  const [owner, otherHr] = await Promise.all([createHr(), createHr()]);
  const [applicant, bystander] = await Promise.all([createCandidate(), createCandidate()]);
  const job = await createJobFor(owner.id);

  const response = await apply(
    formRequest(`/api/jobs/${job._id}/applications`, applicationForm(pdfFile(filename)), {
      cookie: applicant.cookie,
    }),
    routeContext({ id: String(job._id) }),
  );
  const { data } = await readJson<ApiData<PublicApplication>>(response);

  return { owner, otherHr, applicant, bystander, job, applicationId: data.id };
}

function download(applicationId: string, cookie?: string) {
  return downloadResume(
    jsonRequest(`/api/applications/${applicationId}/resume`, cookie ? { cookie } : {}),
    routeContext({ id: applicationId }),
  );
}

describe('GET /api/applications/:id/resume', () => {
  it('serves the PDF to the HR user who owns the listing', async () => {
    const { owner, applicationId } = await seedApplication();

    const response = await download(applicationId, owner.cookie);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdfBytes());
  });

  it('serves the PDF back to the candidate who uploaded it', async () => {
    const { applicant, applicationId } = await seedApplication();

    const response = await download(applicationId, applicant.cookie);

    expect(response.status).toBe(200);
  });

  it('sets headers that keep a resume private and inert', async () => {
    const { owner, applicationId } = await seedApplication('Ada Lovelace CV.pdf');

    const response = await download(applicationId, owner.cookie);

    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain('"Ada Lovelace CV.pdf"');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('denies another HR user with 403', async () => {
    const { otherHr, applicationId } = await seedApplication();

    expect((await download(applicationId, otherHr.cookie)).status).toBe(403);
  });

  it('denies a candidate who is not the applicant with 403', async () => {
    const { bystander, applicationId } = await seedApplication();

    expect((await download(applicationId, bystander.cookie)).status).toBe(403);
  });

  it('denies an anonymous request with 401', async () => {
    const { applicationId } = await seedApplication();

    expect((await download(applicationId)).status).toBe(401);
  });

  it('returns 404 when the application does not exist', async () => {
    const { owner } = await seedApplication();

    expect((await download('000000000000000000000000', owner.cookie)).status).toBe(404);
  });

  it('returns 404 when the record survives but the file is gone', async () => {
    const { owner, applicationId } = await seedApplication();
    await Application.updateOne(
      { _id: applicationId },
      { 'resume.storedName': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf' },
    );

    expect((await download(applicationId, owner.cookie)).status).toBe(404);
  });

  it('refuses a stored name that would escape the uploads directory', async () => {
    const { owner, applicationId } = await seedApplication();
    // Only reachable by tampering with the database directly, since stored
    // names are server-generated UUIDs — this pins the defence-in-depth check.
    await Application.updateOne(
      { _id: applicationId },
      { 'resume.storedName': '../../../../etc/passwd' },
    );

    expect((await download(applicationId, owner.cookie)).status).toBe(404);
  });
});

describe('sanitizeOriginalName', () => {
  it.each([
    ['../../etc/passwd.pdf', 'passwd.pdf'],
    ['C:\\Users\\me\\resume.pdf', 'resume.pdf'],
    ['résumé final.pdf', 'r_sum_ final.pdf'],
    ['....pdf', 'pdf.pdf'],
    ['', 'resume.pdf'],
    ['notes', 'notes.pdf'],
  ])('reduces %j to %j', (input, expected) => {
    expect(sanitizeOriginalName(input)).toBe(expected);
  });

  it('strips quotes and control characters that could break out of a header', () => {
    const result = sanitizeOriginalName('bad"name\r\n.pdf');

    expect(result).not.toMatch(/["\r\n]/);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('caps the length', () => {
    expect(sanitizeOriginalName(`${'a'.repeat(500)}.pdf`).length).toBeLessThanOrEqual(124);
  });
});
