import mongoose, { type Mongoose } from 'mongoose';

import { getEnv } from '@/lib/env';

/**
 * Next.js hot-reloads server modules in development and runs route handlers in
 * a shared process in production, so the Mongoose connection is memoised on
 * `globalThis`. Without this, every reload would open a new pool and eventually
 * exhaust Mongo's connection limit.
 */
type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose.__mongooseCache ??= {
  conn: null,
  promise: null,
});

export async function connectToDatabase(): Promise<Mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    // Fail fast instead of buffering operations forever behind a dead server.
    mongoose.set('bufferCommands', false);
    mongoose.set('strictQuery', true);

    cache.promise = mongoose.connect(getEnv().MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Drop the rejected promise so the next request can retry the connection.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.conn) return;
  await cache.conn.disconnect();
  cache.conn = null;
  cache.promise = null;
}
