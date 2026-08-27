import { GET as getProfile, PATCH as patchProfile } from '@/app/api/users/me/route';
import { User, type PublicUser } from '@/modules/users/user.model';

import { createCandidate, createHr } from './helpers/auth';
import {
  jsonRequest,
  readJson,
  routeContext,
  type ApiData,
  type ApiError,
} from './helpers/request';

const noParams = routeContext({});

function patch(body: unknown, cookie?: string) {
  return patchProfile(
    jsonRequest('/api/users/me', { method: 'PATCH', body, ...(cookie ? { cookie } : {}) }),
    noParams,
  );
}

describe('GET /api/users/me', () => {
  it('returns the caller’s own profile without the password hash', async () => {
    const candidate = await createCandidate();

    const response = await getProfile(
      jsonRequest('/api/users/me', { cookie: candidate.cookie }),
      noParams,
    );

    expect(response.status).toBe(200);
    const body = await readJson<ApiData<PublicUser>>(response);
    expect(body.data.id).toBe(candidate.id);
    expect(body.data).not.toHaveProperty('passwordHash');
  });

  it('returns 401 when signed out', async () => {
    const response = await getProfile(jsonRequest('/api/users/me'), noParams);
    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  it('updates the editable profile fields', async () => {
    const candidate = await createCandidate();

    const response = await patch(
      {
        name: 'Sam Rivera',
        phone: '+91 98765 43210',
        headline: 'Full-stack engineer',
        skills: ['TypeScript', 'MongoDB'],
      },
      candidate.cookie,
    );

    expect(response.status).toBe(200);
    const body = await readJson<ApiData<PublicUser>>(response);
    expect(body.data).toMatchObject({
      name: 'Sam Rivera',
      phone: '+91 98765 43210',
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'MongoDB'],
    });
  });

  it('accepts a partial update and leaves the other fields alone', async () => {
    const candidate = await createCandidate();
    await patch({ headline: 'Original headline', skills: ['Go'] }, candidate.cookie);

    const response = await patch({ name: 'Renamed Only' }, candidate.cookie);
    const body = await readJson<ApiData<PublicUser>>(response);

    expect(body.data.name).toBe('Renamed Only');
    expect(body.data.headline).toBe('Original headline');
    expect(body.data.skills).toEqual(['Go']);
  });

  it('works for HR accounts too', async () => {
    const hr = await createHr();

    const response = await patch({ headline: 'Talent partner' }, hr.cookie);

    expect(response.status).toBe(200);
    expect((await readJson<ApiData<PublicUser>>(response)).data.headline).toBe('Talent partner');
  });

  it('parses a comma-separated skills string, trimming and de-duplicating', async () => {
    const candidate = await createCandidate();

    const response = await patch(
      { skills: ' React , react ,  Node.js ,, TypeScript ' },
      candidate.cookie,
    );

    expect((await readJson<ApiData<PublicUser>>(response)).data.skills).toEqual([
      'React',
      'Node.js',
      'TypeScript',
    ]);
  });

  it('ignores attempts to change email, role or password hash', async () => {
    const candidate = await createCandidate();

    const response = await patch(
      {
        name: 'Still A Candidate',
        email: 'attacker@example.com',
        role: 'HR',
        passwordHash: 'injected',
      },
      candidate.cookie,
    );

    expect(response.status).toBe(200);

    const stored = await User.findById(candidate.id).select('+passwordHash');
    expect(stored?.email).toBe(candidate.email);
    expect(stored?.role).toBe('CANDIDATE');
    expect(stored?.passwordHash).not.toBe('injected');
    expect(stored?.name).toBe('Still A Candidate');
  });

  it('cannot be pointed at another user’s account', async () => {
    const [candidate, victim] = await Promise.all([createCandidate(), createCandidate()]);

    await patch({ name: 'Hijacked', id: victim.id, _id: victim.id }, candidate.cookie);

    expect((await User.findById(victim.id))?.name).not.toBe('Hijacked');
    expect((await User.findById(candidate.id))?.name).toBe('Hijacked');
  });

  it.each([
    [{ name: 'A' }, 'name'],
    [{ phone: 'call me maybe' }, 'phone'],
    [{ headline: 'x'.repeat(161) }, 'headline'],
    [{ skills: Array.from({ length: 31 }, (_, index) => `skill${index}`) }, 'skills'],
  ])('rejects invalid input %j with a 400 naming %s', async (body, field) => {
    const candidate = await createCandidate();

    const response = await patch(body, candidate.cookie);

    expect(response.status).toBe(400);
    const details = (await readJson<ApiError>(response)).error.details as Record<string, string[]>;
    expect(Object.keys(details)).toContain(field);
  });

  it('rejects an empty update body with 400', async () => {
    const candidate = await createCandidate();
    expect((await patch({}, candidate.cookie)).status).toBe(400);
  });

  it('rejects an unauthenticated update with 401', async () => {
    const response = await patch({ name: 'Anonymous' });
    expect(response.status).toBe(401);
  });
});
