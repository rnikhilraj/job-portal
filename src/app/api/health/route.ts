import mongoose from 'mongoose';

import { ok } from '@/lib/api/respond';
import { withRoute } from '@/lib/api/route';

const CONNECTION_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

/** Liveness/readiness probe used by Docker and by humans verifying a fresh boot. */
export const GET = withRoute(async () =>
  ok({
    status: 'ok',
    database: CONNECTION_STATES[mongoose.connection.readyState] ?? 'unknown',
  }),
);
