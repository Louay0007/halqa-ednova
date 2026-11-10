import { signToken, verifyToken } from '../../src/security/tokens';

const SECRET = 'unit-test-secret';

describe('session tokens (HMAC)', () => {
  it('signs and verifies a round trip', () => {
    const t = signToken({ sub: 'L-01', role: 'learner' }, SECRET);
    const body = verifyToken(t, SECRET);
    expect(body).toMatchObject({ sub: 'L-01', role: 'learner' });
  });
  it('rejects wrong secret', () => {
    const t = signToken({ sub: 'L-01', role: 'learner' }, SECRET);
    expect(verifyToken(t, 'other')).toBeNull();
  });
  it('rejects tampered payload', () => {
    const t = signToken({ sub: 'L-01', role: 'learner' }, SECRET);
    const [data, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'L-99', role: 'admin' })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(data).toBeDefined();
  });
  it('rejects expired tokens', () => {
    const t = signToken({ sub: 'L-01', role: 'learner' }, SECRET, -1);
    expect(verifyToken(t, SECRET)).toBeNull();
  });
});
