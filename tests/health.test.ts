import mongoose from 'mongoose';

import { GET as health } from '@/app/api/health/route';

import { jsonRequest, readJson, routeContext, type ApiData } from './helpers/request';

type HealthBody = { status: string; database: string };

const noParams = routeContext({});

const callHealth = () => health(jsonRequest('/api/health'), noParams);

/**
 * Stubs the driver's connection state for one assertion.
 *
 * `readyState` is a getter on Connection.prototype, so an own property shadows
 * it and `delete` restores the real one. Nothing reconnects underneath: the
 * connection is memoised in `src/lib/db.ts`, so `withRoute` returns the cached
 * handle rather than dialling out again.
 */
async function withReadyState<T>(state: number, run: () => Promise<T>): Promise<T> {
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: state,
    configurable: true,
  });
  try {
    return await run();
  } finally {
    delete (mongoose.connection as unknown as { readyState?: number }).readyState;
  }
}

describe('GET /api/health', () => {
  it('reports ok and a connected database', async () => {
    const response = await callHealth();

    expect(response.status).toBe(200);
    const body = await readJson<ApiData<HealthBody>>(response);
    expect(body.data).toEqual({ status: 'ok', database: 'connected' });
  });

  it('answers in the standard success envelope, with no meta', async () => {
    const body = await readJson<ApiData<HealthBody>>(await callHealth());

    expect(Object.keys(body)).toEqual(['data']);
    expect(body).not.toHaveProperty('error');
  });

  /*
   * The probe is only useful if it distinguishes states. Docker reads the status
   * code, but a human reading the body during a partial outage needs the word to
   * be accurate, so each mapped state is pinned rather than assumed.
   */
  it.each([
    [0, 'disconnected'],
    [1, 'connected'],
    [2, 'connecting'],
    [3, 'disconnecting'],
    [99, 'uninitialized'],
  ])('maps driver readyState %i to "%s"', async (state, expected) => {
    const body = await withReadyState(state, async () =>
      readJson<ApiData<HealthBody>>(await callHealth()),
    );

    expect(body.data.database).toBe(expected);
  });

  it('falls back to "unknown" for a state the driver has not documented', async () => {
    const body = await withReadyState(42, async () =>
      readJson<ApiData<HealthBody>>(await callHealth()),
    );

    expect(body.data.database).toBe('unknown');
  });

  it('needs no session — it is reachable before anyone signs in', async () => {
    expect((await callHealth()).status).toBe(200);
  });
});
