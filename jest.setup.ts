import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { connectToDatabase, disconnectFromDatabase } from '@/lib/db';
import { resetEnvCache } from '@/lib/env';

/**
 * Each test file gets its own ephemeral MongoDB and its own uploads directory,
 * so suites are hermetic and leave nothing behind. Environment variables are
 * assigned before any handler runs; `src/lib/env.ts` parses lazily, so this is
 * early enough for every module under test.
 */
let mongoServer: MongoMemoryServer;
let uploadsDir: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-portal-uploads-'));

  process.env.MONGODB_URI = mongoServer.getUri('job_portal_test');
  process.env.JWT_SECRET = 'test_secret_value_that_is_long_enough_1234567890';
  process.env.JWT_EXPIRES_IN_SECONDS = '3600';
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.MAX_RESUME_BYTES = String(1024 * 1024);
  process.env.SEED_ON_BOOT = 'false';
  resetEnvCache();

  // Connect up front so factories can write fixtures before the first handler
  // call, which is what would otherwise open the connection.
  await connectToDatabase();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));

  // Uploaded resumes are state too — a leftover file would make the next test's
  // assertions about the uploads directory meaningless.
  const files = await fs.readdir(uploadsDir).catch(() => []);
  await Promise.all(files.map((file) => fs.rm(path.join(uploadsDir, file), { force: true })));
});

afterAll(async () => {
  await disconnectFromDatabase();
  await mongoServer?.stop();
  if (uploadsDir) {
    await fs.rm(uploadsDir, { recursive: true, force: true });
  }
});
