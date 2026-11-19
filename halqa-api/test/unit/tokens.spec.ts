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

  describe('secret rotation (§3.9)', () => {
    const NEW = 'the-new-secret';

    it('accepts a token signed with the previous secret during the window', () => {
      const old = signToken({ sub: 'L-01', role: 'learner' }, SECRET);
      // This is the whole point: rotating the env var must not sign everyone out.
      expect(verifyToken(old, [NEW, SECRET])).toMatchObject({ sub: 'L-01' });
    });

    it('still rejects a token signed with a secret that is not in the list', () => {
      const stranger = signToken({ sub: 'L-01', role: 'learner' }, 'some-third-secret');
      expect(verifyToken(stranger, [NEW, SECRET])).toBeNull();
    });

    it('accepts new-secret tokens immediately, so rotation needs no grace period to start', () => {
      const fresh = signToken({ sub: 'L-01', role: 'learner' }, NEW);
      expect(verifyToken(fresh, [NEW, SECRET])).toMatchObject({ sub: 'L-01' });
    });

    it('drops the old secret once it is removed from the list', () => {
      const old = signToken({ sub: 'L-01', role: 'learner' }, SECRET);
      expect(verifyToken(old, [NEW])).toBeNull();
    });

    it('treats an empty previous secret as absent rather than as a valid key', () => {
      const t = signToken({ sub: 'L-01', role: 'learner' }, '');
      expect(verifyToken(t, [NEW, ''])).toBeNull();
    });

    it('defaults to a 2h access TTL, short enough to bound a leak', () => {
      const t = signToken({ sub: 'L-01', role: 'learner' }, SECRET);
      const body = verifyToken(t, SECRET)!;
      expect(body.exp - body.iat).toBe(2 * 60 * 60);
    });
  });
});
