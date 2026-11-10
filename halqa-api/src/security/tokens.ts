import { createHmac, timingSafeEqual } from 'crypto';

export type TokenRole = 'learner' | 'mentor' | 'admin';

export interface SessionToken {
  sub: string; // learnerId / mentorId
  role: TokenRole;
  iat: number;
  exp: number;
}

const SEP = '.';

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signToken(payload: Omit<SessionToken, 'iat' | 'exp'>, secret: string, ttlS = 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionToken = { ...payload, iat: now, exp: now + ttlS };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}${SEP}${sig}`;
}

export function verifyToken(token: string, secret: string): SessionToken | null {
  const [data, sig] = token.split(SEP);
  if (!data || !sig) return null;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionToken;
    if (typeof body.exp !== 'number' || body.exp * 1000 < Date.now()) return null;
    if (!body.sub || !body.role) return null;
    return body;
  } catch {
    return null;
  }
}
