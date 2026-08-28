import { DELETE as deleteJobRoute } from '@/app/api/jobs/[id]/route';
import { Application } from '@/modules/applications/application.model';
import { POST as apply } from '@/app/api/jobs/[id]/applications/route';

import { createCandidate, createHr } from './helpers/auth';
import { createJobFor } from './helpers/factories';
import { applicationForm, pdfFile } from './helpers/files';
import { formRequest, jsonRequest, routeContext } from './helpers/request';

/**
 * How many application records still existed each time a resume file was
 * unlinked. Deleting a job is a two-step cascade that cannot be atomic, and the
 * order decides which way a partial failure fails.
 */
const mockRecordsAliveAtUnlink: number[] = [];

jest.mock('../src/lib/resume-storage', () => {
  const actual = jest.requireActual('../src/lib/resume-storage');
  return {
    ...actual,
    deleteResume: async (storedName: string) => {
      const { Application: Model } = jest.requireActual(
        '../src/modules/applications/application.model',
      );
      mockRecordsAliveAtUnlink.push(await Model.countDocuments({}));
      return actual.deleteResume(storedName);
    },
  };
});

beforeEach(() => {
  mockRecordsAliveAtUnlink.length = 0;
});

describe('deleting a job removes records before the files they point at', () => {
  /*
   * This pins the order, not just the end state — the end state is identical
   * either way, which is exactly why the bug was invisible.
   *
   * Records first means a failed unlink leaves unreferenced garbage on the
   * volume: harmless, and reclaimable. Files first means a failed deleteMany
   * leaves live applications whose resume download 404s, which is a broken
   * record a user can see. Reverse the two statements in
   * deleteApplicationsForJob and this test fails.
   */
  it('has already deleted the application rows by the time a resume is unlinked', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    for (const candidate of [await createCandidate(), await createCandidate()]) {
      await apply(
        formRequest(`/api/jobs/${job._id}/applications`, applicationForm(pdfFile()), {
          cookie: candidate.cookie,
        }),
        routeContext({ id: String(job._id) }),
      );
    }
    expect(await Application.countDocuments()).toBe(2);

    const response = await deleteJobRoute(
      jsonRequest(`/api/jobs/${job._id}`, { method: 'DELETE', cookie: hr.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(204);
    // One observation per resume, each taken with the collection already empty.
    expect(mockRecordsAliveAtUnlink).toEqual([0, 0]);
  });

  it('unlinks nothing at all when the listing had no applicants', async () => {
    const hr = await createHr();
    const job = await createJobFor(hr.id);

    const response = await deleteJobRoute(
      jsonRequest(`/api/jobs/${job._id}`, { method: 'DELETE', cookie: hr.cookie }),
      routeContext({ id: String(job._id) }),
    );

    expect(response.status).toBe(204);
    expect(mockRecordsAliveAtUnlink).toEqual([]);
  });
});
