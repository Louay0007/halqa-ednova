import { createHmac, timingSafeEqual } from 'crypto';

export type TokenRole = 'learner' | 'mentor' | 'admin';

export interface SessionToken {
  sub: string; // learnerId / mentorId
  role: TokenRole;
  iat: number;
  exp: number;
  /** Token epoch: matches `Learner.tokenEpoch`. Bumping the stored value revokes. */
  ep?: number;
}

const SEP = '.';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Access-token lifetime. Short enough that a leaked token expires in a school
 *  day, long enough that a full session does not need a refresh mid-circle.
 *  `POST /auth/refresh` re-mints without re-entering a passphrase. */
export const ACCESS_TTL_S = 2 * 60 * 60;

export function signToken(
  payload: Omit<SessionToken, 'iat' | 'exp'>,
  secret: string,
  ttlS = ACCESS_TTL_S,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionToken = { ...payload, iat: now, exp: now + ttlS };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}${SEP}${sig}`;
}

/**
 * Verify against a **list** of secrets, current first.
 *
 * Rotating `TOKEN_SECRET` used to sign everyone out at once, because a token
 * signed with the old key failed verification the moment the env var changed —
 * making rotation an outage. Accepting `TOKEN_SECRET` and `TOKEN_SECRET_PREVIOUS`
 * turns rotation into a normal rolling deploy: set the new value as current, keep
 * the old one as previous for one release, then drop it.
 */
export function verifyToken(token: string, secrets: string | string[]): SessionToken | null {
  const [data, sig] = token.split(SEP);
  if (!data || !sig) return null;
  const candidates = Array.isArray(secrets) ? secrets : [secrets];

  const given = Buffer.from(sig);
  let matched = false;
  for (const secret of candidates) {
    if (!secret) continue;
    const expected = Buffer.from(createHmac('sha256', secret).update(data).digest('base64url'));
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      matched = true;
      break;
    }
  }
  if (!matched) return null;

  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionToken;
    if (typeof body.exp !== 'number' || body.exp * 1000 < Date.now()) return null;
    if (!body.sub || !body.role) return null;
    return body;
  } catch {
    return null;
  }
}
