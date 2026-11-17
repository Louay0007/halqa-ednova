import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

/**
 * Passphrase hashing for account sign-in.
 *
 * The platform is PII-free by design — `schema-gate.spec.ts` fails the build if
 * a mail address, phone number or any other identifying field appears in a
 * schema — so an account is a chosen pseudonym (`handle`) plus a secret the
 * learner keeps. scrypt ships with Node, so this costs no dependency.
 *
 * `N=16384, r=8, p=1` needs 16 MB of memory (under scrypt's 32 MB default cap)
 * and stays in the tens of milliseconds per verification.
 */
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const PARAMS = { N: 16_384, r: 8, p: 1 } as const;
const KEYLEN = 64;

export const PASSPHRASE_MIN = 8;
export const PASSPHRASE_MAX = 128;
/** Lowercase, 3–20 chars, no ambiguous leading punctuation. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,19}$/;

export function normaliseHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface Credential {
  secretSalt: string;
  secretHash: string;
}

export async function hashPassphrase(passphrase: string): Promise<Credential> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(passphrase.normalize('NFKC'), salt, KEYLEN, PARAMS);
  return { secretSalt: salt.toString('base64'), secretHash: hash.toString('base64') };
}

/** Constant-time comparison; a malformed or missing row is simply a failed match. */
export async function verifyPassphrase(passphrase: string, stored: Partial<Credential>): Promise<boolean> {
  if (!stored.secretSalt || !stored.secretHash) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(stored.secretHash, 'base64');
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;
  const actual = await scryptAsync(passphrase.normalize('NFKC'), Buffer.from(stored.secretSalt, 'base64'), KEYLEN, PARAMS);
  return timingSafeEqual(actual, expected);
}
