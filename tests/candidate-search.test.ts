import { GET as searchCandidatesRoute } from '@/app/api/candidates/route';
import { GET as getCandidate } from '@/app/api/candidates/[id]/route';
import { GET as downloadCandidateResume } from '@/app/api/candidates/[id]/resume/route';
import { PATCH as patchProfile } from '@/app/api/users/me/route';
import {
  DELETE as deleteOwnResume,
  GET as downloadOwnResume,
  PUT as putOwnResume,
} from '@/app/api/users/me/resume/route';
import { User, type DiscoverableCandidate } from '@/modules/users/user.model';
import type { ExperienceLevel } from '@/modules/users/user.constants';

import { createCandidate, createHr } from './helpers/auth';
import { applicationForm, pdfBytes, pdfFile } from './helpers/files';
import {
  formRequest,
  jsonRequest,
  readJson,
  routeContext,
  type ApiData,
  type ApiError,
} from './helpers/request';

const noParams = routeContext({});

type CandidateSeed = {
  name: string;
  headline?: string;
  skills?: string[];
  experienceLevel?: ExperienceLevel;
  isSearchable: boolean;
};

async function seedCandidate(seed: CandidateSeed) {
  const candidate = await createCandidate({ name: seed.name });

  await User.updateOne(
    { _id: candidate.id },
    {
      headline: seed.headline,
      skills: seed.skills ?? [],
      experienceLevel: seed.experienceLevel,
      isSearchable: seed.isSearchable,
    },
  );

  return candidate;
}

/** Uploads a general profile resume as the given candidate. */
async function uploadResume(cookie: string, filename = 'resume.pdf') {
  const form = applicationForm(pdfFile(filename));
  const response = await putOwnResume(
    formRequest('/api/users/me/resume', form, { method: 'PUT', cookie }),
    noParams,
  );
  if (response.status !== 200) {
    throw new Error(`resume upload failed with ${response.status}`);
  }
  return response;
}

async function search(cookie: string, query = '') {
  const response = await searchCandidatesRoute(
    jsonRequest(`/api/candidates${query}`, { cookie }),
    noParams,
  );
  const body = await readJson<ApiData<DiscoverableCandidate[]>>(response);
  return { status: response.status, body, names: (body.data ?? []).map((c) => c.name) };
}

describe('GET /api/candidates — access control', () => {
  it('rejects a candidate with 403', async () => {
    const candidate = await createCandidate();

    const response = await searchCandidatesRoute(
      jsonRequest('/api/candidates', { cookie: candidate.cookie }),
      noParams,
    );

    expect(response.status).toBe(403);
    expect((await readJson<ApiError>(response)).error.code).toBe('FORBIDDEN');
  });

  it('rejects an anonymous request with 401', async () => {
    const response = await searchCandidatesRoute(jsonRequest('/api/candidates'), noParams);
    expect(response.status).toBe(401);
  });

  it('allows any HR user — the directory is not scoped to one recruiter', async () => {
    const [hrA, hrB] = await Promise.all([createHr(), createHr()]);
    await seedCandidate({ name: 'Opted In', isSearchable: true });

    expect((await search(hrA.cookie)).names).toEqual(['Opted In']);
    expect((await search(hrB.cookie)).names).toEqual(['Opted In']);
  });
});

describe('GET /api/candidates — the opt-in boundary', () => {
  it('returns only candidates who have opted in', async () => {
    const hr = await createHr();
    await seedCandidate({ name: 'Visible One', isSearchable: true });
    await seedCandidate({ name: 'Hidden One', isSearchable: false });

    const { names, body } = await search(hr.cookie);

    expect(names).toEqual(['Visible One']);
    expect(body.meta?.total).toBe(1);
  });

  it('never surfaces a non-searchable candidate even when they match the query well', async () => {
    const hr = await createHr();
    await seedCandidate({
      name: 'Priya Sharma',
      headline: 'Senior Kubernetes engineer',
      skills: ['Kubernetes', 'Go'],
      isSearchable: false,
    });

    for (const query of [
      '?q=Priya',
      '?q=Kubernetes',
      '?q=kubernetes+engineer',
      '?q=Go',
      '?experienceLevel=SENIOR',
      '',
    ]) {
      expect((await search(hr.cookie, query)).names).toEqual([]);
    }
  });

  it('treats an account that predates the field as opted out', async () => {
    const hr = await createHr();
    const candidate = await createCandidate({ name: 'Legacy Account' });
    // Simulate a document written before isSearchable existed.
    await User.collection.updateOne(
      { _id: candidate.user._id },
      { $unset: { isSearchable: '' } },
    );

    expect((await search(hr.cookie)).names).toEqual([]);
  });

  it('excludes HR accounts even when they match the query', async () => {
    const hr = await createHr({ name: 'Recruiter Person' });
    // An HR account cannot set isSearchable through the API; force it directly
    // to prove the role filter, not just the flag, is doing work.
    await User.updateOne({ _id: hr.id }, { isSearchable: true, headline: 'Recruiter Person' });

    expect((await search(hr.cookie, '?q=Recruiter')).names).toEqual([]);
  });

  it('drops a candidate from results as soon as they toggle the opt-in off', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({
      name: 'Sam Rivera',
      headline: 'Full-stack engineer',
      isSearchable: true,
    });

    expect((await search(hr.cookie)).names).toEqual(['Sam Rivera']);

    const response = await patchProfile(
      jsonRequest('/api/users/me', {
        method: 'PATCH',
        body: { isSearchable: false },
        cookie: candidate.cookie,
      }),
      noParams,
    );
    expect(response.status).toBe(200);

    expect((await search(hr.cookie)).names).toEqual([]);
    expect((await search(hr.cookie, '?q=Sam')).names).toEqual([]);
  });

  it('adds a candidate to results as soon as they toggle the opt-in on', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'Late Joiner', isSearchable: false });

    expect((await search(hr.cookie)).names).toEqual([]);

    await patchProfile(
      jsonRequest('/api/users/me', {
        method: 'PATCH',
        body: { isSearchable: true },
        cookie: candidate.cookie,
      }),
      noParams,
    );

    expect((await search(hr.cookie)).names).toEqual(['Late Joiner']);
  });
});

describe('GET /api/candidates — what the results expose', () => {
  it('includes contact details for an opted-in candidate', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({
      name: 'Sam Rivera',
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'MongoDB'],
      experienceLevel: 'SENIOR',
      isSearchable: true,
    });
    await User.updateOne({ _id: candidate.id }, { phone: '+91 90000 11111' });

    const [result] = (await search(hr.cookie)).body.data;

    expect(result).toEqual({
      id: candidate.id,
      name: 'Sam Rivera',
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'MongoDB'],
      experienceLevel: 'SENIOR',
      email: candidate.email,
      phone: '+91 90000 11111',
      resume: null,
    });
  });

  it('never exposes the password hash or the resume path on disk', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'Sam Rivera', isSearchable: true });
    await uploadResume(candidate.cookie);

    const stored = await User.findById(candidate.id);
    const serialised = JSON.stringify((await search(hr.cookie)).body);

    expect(serialised).not.toContain('passwordHash');
    expect(serialised).not.toContain('$2a$');
    expect(serialised).not.toContain('storedName');
    expect(serialised).not.toContain(stored?.resume?.storedName ?? 'unreachable');
  });

  it('reports null for an experience level or resume that is not set', async () => {
    const hr = await createHr();
    await seedCandidate({ name: 'Bare Profile', isSearchable: true });

    const [result] = (await search(hr.cookie)).body.data;
    expect(result?.experienceLevel).toBeNull();
    expect(result?.resume).toBeNull();
  });

  it('summarises an uploaded resume without leaking where it lives', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'With Resume', isSearchable: true });
    await uploadResume(candidate.cookie, 'Sam Rivera CV.pdf');

    const [result] = (await search(hr.cookie)).body.data;
    expect(result?.resume).toEqual({
      originalName: 'Sam Rivera CV.pdf',
      sizeBytes: pdfBytes().byteLength,
    });
  });
});

describe('GET /api/candidates — search, filter and pagination', () => {
  async function seedDirectory() {
    await seedCandidate({
      name: 'Alice Kumar',
      headline: 'Backend engineer',
      skills: ['Go', 'PostgreSQL'],
      experienceLevel: 'SENIOR',
      isSearchable: true,
    });
    await seedCandidate({
      name: 'Bob Fernandes',
      headline: 'Frontend developer',
      skills: ['React', 'TypeScript'],
      experienceLevel: 'MID',
      isSearchable: true,
    });
    await seedCandidate({
      name: 'Carol Menon',
      headline: 'Platform engineer',
      skills: ['Kubernetes', 'Go'],
      experienceLevel: 'LEAD',
      isSearchable: true,
    });
  }

  it('searches across name, headline and skills', async () => {
    const hr = await createHr();
    await seedDirectory();

    expect((await search(hr.cookie, '?q=alice')).names).toEqual(['Alice Kumar']);
    expect((await search(hr.cookie, '?q=engineer')).names.sort()).toEqual([
      'Alice Kumar',
      'Carol Menon',
    ]);
    expect((await search(hr.cookie, '?q=Go')).names.sort()).toEqual([
      'Alice Kumar',
      'Carol Menon',
    ]);
  });

  it('matches case-insensitively', async () => {
    const hr = await createHr();
    await seedDirectory();

    expect((await search(hr.cookie, '?q=REACT')).names).toEqual(['Bob Fernandes']);
  });

  it('treats regex metacharacters in the search term as literal text', async () => {
    const hr = await createHr();
    await seedDirectory();

    // As a pattern this would match every candidate; escaped, it matches none.
    expect((await search(hr.cookie, '?q=.*')).names).toEqual([]);
  });

  it('filters by experience level, and combines it with the keyword', async () => {
    const hr = await createHr();
    await seedDirectory();

    expect((await search(hr.cookie, '?experienceLevel=LEAD')).names).toEqual(['Carol Menon']);
    expect((await search(hr.cookie, '?experienceLevel=SENIOR&q=Go')).names).toEqual([
      'Alice Kumar',
    ]);
    expect((await search(hr.cookie, '?experienceLevel=ENTRY')).names).toEqual([]);
  });

  it('rejects an unknown experience level with 400', async () => {
    const hr = await createHr();

    const response = await searchCandidatesRoute(
      jsonRequest('/api/candidates?experienceLevel=PRINCIPAL', { cookie: hr.cookie }),
      noParams,
    );

    expect(response.status).toBe(400);
  });

  it('paginates and reports accurate metadata', async () => {
    const hr = await createHr();
    await seedDirectory();

    const firstPage = await search(hr.cookie, '?limit=2&page=1');
    const lastPage = await search(hr.cookie, '?limit=2&page=2');
    const beyondEnd = await search(hr.cookie, '?limit=2&page=9');

    expect(firstPage.names).toHaveLength(2);
    expect(firstPage.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(lastPage.names).toHaveLength(1);
    expect(beyondEnd.names).toHaveLength(0);
  });

  it('counts only opted-in candidates in the pagination total', async () => {
    const hr = await createHr();
    await seedDirectory();
    await seedCandidate({ name: 'Hidden A', isSearchable: false });
    await seedCandidate({ name: 'Hidden B', isSearchable: false });

    expect((await search(hr.cookie, '?limit=2')).body.meta?.total).toBe(3);
  });

  it('refuses a page size above the cap', async () => {
    const hr = await createHr();

    const response = await searchCandidatesRoute(
      jsonRequest('/api/candidates?limit=5000', { cookie: hr.cookie }),
      noParams,
    );

    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/users/me — the opt-in fields', () => {
  function patch(body: unknown, cookie: string) {
    return patchProfile(
      jsonRequest('/api/users/me', { method: 'PATCH', body, cookie }),
      noParams,
    );
  }

  it('defaults a new candidate to not searchable', async () => {
    const candidate = await createCandidate();
    expect((await User.findById(candidate.id))?.isSearchable).toBe(false);
  });

  it('lets a candidate opt in and set an experience level', async () => {
    const candidate = await createCandidate();

    const response = await patch({ isSearchable: true, experienceLevel: 'MID' }, candidate.cookie);

    expect(response.status).toBe(200);
    const { data } = await readJson<ApiData<{ isSearchable: boolean; experienceLevel: string }>>(
      response,
    );
    expect(data).toMatchObject({ isSearchable: true, experienceLevel: 'MID' });
  });

  it('clears the experience level when the form submits the empty option', async () => {
    const candidate = await createCandidate();
    await patch({ experienceLevel: 'LEAD' }, candidate.cookie);

    const response = await patch({ experienceLevel: '' }, candidate.cookie);

    expect(response.status).toBe(200);
    expect((await User.findById(candidate.id))?.experienceLevel).toBeUndefined();
  });

  it('rejects an invalid experience level with 400', async () => {
    const candidate = await createCandidate();

    const response = await patch({ experienceLevel: 'PRINCIPAL' }, candidate.cookie);

    expect(response.status).toBe(400);
    const details = (await readJson<ApiError>(response)).error.details as Record<string, string[]>;
    expect(Object.keys(details)).toContain('experienceLevel');
  });

  it('rejects a non-boolean isSearchable with 400', async () => {
    const candidate = await createCandidate();

    const response = await patch({ isSearchable: 'yes' }, candidate.cookie);

    expect(response.status).toBe(400);
  });

  it('refuses the candidate-only fields on an HR account', async () => {
    const hr = await createHr();

    const response = await patch({ isSearchable: true, experienceLevel: 'LEAD' }, hr.cookie);

    expect(response.status).toBe(400);
    const details = (await readJson<ApiError>(response)).error.details as Record<string, string[]>;
    expect(Object.keys(details).sort()).toEqual(['experienceLevel', 'isSearchable']);
    expect((await User.findById(hr.id))?.isSearchable).toBe(false);
  });

  it('still lets an HR account edit the shared profile fields', async () => {
    const hr = await createHr();

    const response = await patch({ headline: 'Talent partner' }, hr.cookie);

    expect(response.status).toBe(200);
  });
});

describe('GET /api/candidates/:id — recruiter-visible detail view', () => {
  function fetchDetail(candidateId: string, cookie?: string) {
    return getCandidate(
      jsonRequest(`/api/candidates/${candidateId}`, cookie ? { cookie } : {}),
      routeContext({ id: candidateId }),
    );
  }

  it('returns the full recruiter-visible profile for an opted-in candidate', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({
      name: 'Asha Nair',
      headline: 'Backend engineer',
      skills: ['Go'],
      experienceLevel: 'SENIOR',
      isSearchable: true,
    });

    const response = await fetchDetail(candidate.id, hr.cookie);

    expect(response.status).toBe(200);
    const { data } = await readJson<ApiData<DiscoverableCandidate>>(response);
    expect(data).toMatchObject({ id: candidate.id, name: 'Asha Nair', email: candidate.email });
  });

  it('reports an opted-out candidate as not found, not as forbidden', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'Hidden', isSearchable: false });

    // Indistinguishable from a deleted account, so a stale id reveals nothing.
    expect((await fetchDetail(candidate.id, hr.cookie)).status).toBe(404);
  });

  it('starts returning 404 the moment the candidate opts out', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'Was Visible', isSearchable: true });

    expect((await fetchDetail(candidate.id, hr.cookie)).status).toBe(200);

    await patchProfile(
      jsonRequest('/api/users/me', {
        method: 'PATCH',
        body: { isSearchable: false },
        cookie: candidate.cookie,
      }),
      noParams,
    );

    expect((await fetchDetail(candidate.id, hr.cookie)).status).toBe(404);
  });

  it('is HR-only and requires a session', async () => {
    const candidate = await seedCandidate({ name: 'Visible', isSearchable: true });
    const other = await createCandidate();

    expect((await fetchDetail(candidate.id, other.cookie)).status).toBe(403);
    expect((await fetchDetail(candidate.id)).status).toBe(401);
  });
});

describe('GET /api/candidates/:id/resume — the resume boundary', () => {
  function download(candidateId: string, cookie?: string) {
    return downloadCandidateResume(
      jsonRequest(`/api/candidates/${candidateId}/resume`, cookie ? { cookie } : {}),
      routeContext({ id: candidateId }),
    );
  }

  async function seedWithResume(isSearchable: boolean) {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'Sam Rivera', isSearchable });
    await uploadResume(candidate.cookie, 'Sam CV.pdf');
    return { hr, candidate };
  }

  it('serves the PDF to HR when the candidate is opted in', async () => {
    const { hr, candidate } = await seedWithResume(true);

    const response = await download(candidate.id, hr.cookie);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('"Sam CV.pdf"');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdfBytes());
  });

  it('refuses with 403 when the candidate is not opted in', async () => {
    const { hr, candidate } = await seedWithResume(false);

    const response = await download(candidate.id, hr.cookie);

    expect(response.status).toBe(403);
    expect((await readJson<ApiError>(response)).error.code).toBe('FORBIDDEN');
  });

  it('makes a previously working link start failing once the candidate opts out', async () => {
    const { hr, candidate } = await seedWithResume(true);

    // The recruiter has the URL and it works.
    expect((await download(candidate.id, hr.cookie)).status).toBe(200);

    await patchProfile(
      jsonRequest('/api/users/me', {
        method: 'PATCH',
        body: { isSearchable: false },
        cookie: candidate.cookie,
      }),
      noParams,
    );

    // Same URL, same session: the link was never a capability.
    expect((await download(candidate.id, hr.cookie)).status).toBe(403);
  });

  it('blocks a candidate from reaching another candidate’s resume', async () => {
    const { candidate } = await seedWithResume(true);
    const bystander = await createCandidate();

    expect((await download(candidate.id, bystander.cookie)).status).toBe(403);
  });

  it('blocks anonymous access', async () => {
    const { candidate } = await seedWithResume(true);
    expect((await download(candidate.id)).status).toBe(401);
  });

  it('returns 404 when an opted-in candidate has uploaded nothing', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'No Resume', isSearchable: true });

    expect((await download(candidate.id, hr.cookie)).status).toBe(404);
  });

  it('checks the opt-in before the file, so opting out hides even a missing resume', async () => {
    const hr = await createHr();
    const candidate = await seedCandidate({ name: 'No Resume', isSearchable: false });

    // 403, not 404: the response must not disclose whether a resume exists.
    expect((await download(candidate.id, hr.cookie)).status).toBe(403);
  });
});

describe('/api/users/me/resume — the candidate’s own general resume', () => {
  function ownDownload(cookie?: string) {
    return downloadOwnResume(
      jsonRequest('/api/users/me/resume', cookie ? { cookie } : {}),
      noParams,
    );
  }

  it('uploads a PDF and reports it on the profile', async () => {
    const candidate = await createCandidate();

    const response = await uploadResume(candidate.cookie, 'My CV.pdf');
    const { data } = await readJson<ApiData<{ resume: { originalName: string } | null }>>(
      response,
    );

    expect(data.resume).toEqual({
      originalName: 'My CV.pdf',
      sizeBytes: pdfBytes().byteLength,
    });
  });

  it('stores it under a server-generated name, never the client filename', async () => {
    const candidate = await createCandidate();
    await uploadResume(candidate.cookie, '../../../../etc/passwd.pdf');

    const stored = await User.findById(candidate.id);
    expect(stored?.resume?.storedName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
    );
    expect(stored?.resume?.originalName).toBe('passwd.pdf');
  });

  it('applies the same validation as an application upload', async () => {
    const candidate = await createCandidate();

    const notAPdf = new File([new Uint8Array(Buffer.from('MZ payload'))], 'resume.pdf', {
      type: 'application/pdf',
    });
    const response = await putOwnResume(
      formRequest('/api/users/me/resume', applicationForm(notAPdf), {
        method: 'PUT',
        cookie: candidate.cookie,
      }),
      noParams,
    );

    expect(response.status).toBe(400);
    expect((await readJson<ApiError>(response)).error.message).toMatch(/not a valid pdf/i);
    expect((await User.findById(candidate.id))?.resume).toBeUndefined();
  });

  it('replaces an existing resume and deletes the old file', async () => {
    const candidate = await createCandidate();
    await uploadResume(candidate.cookie, 'first.pdf');
    const first = (await User.findById(candidate.id))?.resume?.storedName;

    await uploadResume(candidate.cookie, 'second.pdf');
    const second = (await User.findById(candidate.id))?.resume?.storedName;

    expect(second).not.toBe(first);
    expect((await User.findById(candidate.id))?.resume?.originalName).toBe('second.pdf');

    const { readResume } = await import('@/lib/resume-storage');
    await expect(readResume(first as string)).rejects.toThrow();
  });

  it('lets the owner download their own resume regardless of the opt-in', async () => {
    const candidate = await createCandidate();
    await uploadResume(candidate.cookie);

    // isSearchable governs recruiter visibility, not self-access.
    expect((await ownDownload(candidate.cookie)).status).toBe(200);

    await patchProfile(
      jsonRequest('/api/users/me', {
        method: 'PATCH',
        body: { isSearchable: true },
        cookie: candidate.cookie,
      }),
      noParams,
    );
    expect((await ownDownload(candidate.cookie)).status).toBe(200);
  });

  it('returns 404 before an upload and 401 when signed out', async () => {
    const candidate = await createCandidate();

    expect((await ownDownload(candidate.cookie)).status).toBe(404);
    expect((await ownDownload()).status).toBe(401);
  });

  it('removes the resume and the file behind it', async () => {
    const candidate = await createCandidate();
    await uploadResume(candidate.cookie);
    const storedName = (await User.findById(candidate.id))?.resume?.storedName;

    const response = await deleteOwnResume(
      jsonRequest('/api/users/me/resume', { method: 'DELETE', cookie: candidate.cookie }),
      noParams,
    );

    expect(response.status).toBe(200);
    expect((await User.findById(candidate.id))?.resume).toBeUndefined();

    const { readResume } = await import('@/lib/resume-storage');
    await expect(readResume(storedName as string)).rejects.toThrow();
  });

  it('refuses an upload from an HR account', async () => {
    const hr = await createHr();

    const response = await putOwnResume(
      formRequest('/api/users/me/resume', applicationForm(pdfFile()), {
        method: 'PUT',
        cookie: hr.cookie,
      }),
      noParams,
    );

    expect(response.status).toBe(403);
  });
});

describe('toDiscoverableCandidate fails closed', () => {
  it('throws rather than redacting if handed a candidate who has not opted in', async () => {
    const { toDiscoverableCandidate } = await import('@/modules/users/user.model');
    const candidate = await seedCandidate({ name: 'Hidden', isSearchable: false });
    const document = await User.findById(candidate.id);

    // A future caller who forgets the isSearchable filter gets a 500 and a
    // server-side log, not a quiet leak of somebody's email address.
    expect(() => toDiscoverableCandidate(document!)).toThrow(/not an opted-in candidate/);
  });

  it('throws for an HR account even if the flag is forced on', async () => {
    const { toDiscoverableCandidate } = await import('@/modules/users/user.model');
    const hr = await createHr();
    await User.updateOne({ _id: hr.id }, { isSearchable: true });
    const document = await User.findById(hr.id);

    expect(() => toDiscoverableCandidate(document!)).toThrow(/not an opted-in candidate/);
  });
});
