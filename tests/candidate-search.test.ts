import { GET as searchCandidatesRoute } from '@/app/api/candidates/route';
import { PATCH as patchProfile } from '@/app/api/users/me/route';
import { User, type SearchableCandidate } from '@/modules/users/user.model';
import type { ExperienceLevel } from '@/modules/users/user.constants';

import { createCandidate, createHr } from './helpers/auth';
import {
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

async function search(cookie: string, query = '') {
  const response = await searchCandidatesRoute(
    jsonRequest(`/api/candidates${query}`, { cookie }),
    noParams,
  );
  const body = await readJson<ApiData<SearchableCandidate[]>>(response);
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
  it('returns the profile summary and nothing contactable', async () => {
    const hr = await createHr();
    await seedCandidate({
      name: 'Sam Rivera',
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'MongoDB'],
      experienceLevel: 'SENIOR',
      isSearchable: true,
    });
    await User.updateOne({ name: 'Sam Rivera' }, { phone: '+91 90000 11111' });

    const { body } = await search(hr.cookie);
    const [result] = body.data;

    expect(result).toEqual({
      id: expect.any(String),
      name: 'Sam Rivera',
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'MongoDB'],
      experienceLevel: 'SENIOR',
    });

    // The privacy boundary, asserted on the serialised payload rather than the
    // object shape, so an accidental extra field would fail here too.
    const serialised = JSON.stringify(body);
    for (const leak of ['email', 'phone', 'passwordHash', 'resume', '@example.com', '90000']) {
      expect(serialised).not.toContain(leak);
    }
  });

  it('reports a null experience level rather than omitting the field', async () => {
    const hr = await createHr();
    await seedCandidate({ name: 'No Level', isSearchable: true });

    expect((await search(hr.cookie)).body.data[0]?.experienceLevel).toBeNull();
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
