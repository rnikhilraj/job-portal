import bcrypt from 'bcryptjs';

/**
 * bcryptjs is used instead of the native `bcrypt` binding: it produces the same
 * `$2a$` hashes without requiring node-gyp/python in the Alpine build stage.
 */
const SALT_ROUNDS = 12;

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Hash of a throwaway value, computed once on first use. Login compares against
 * it when no account matches the submitted email so that a miss costs the same
 * CPU as a real check — otherwise response latency would reveal which email
 * addresses are registered.
 */
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash('password-that-is-never-valid', SALT_ROUNDS);
  return dummyHashPromise;
}

export async function simulatePasswordVerification(plainText: string): Promise<void> {
  await bcrypt.compare(plainText, await getDummyHash());
}
