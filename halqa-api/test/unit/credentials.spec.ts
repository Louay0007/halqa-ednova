// Account credentials: the passphrase layer that turns an anonymous learner
// record into an account. Pure crypto, no Nest boot.
import { HANDLE_RE, hashPassphrase, normaliseHandle, verifyPassphrase } from '../../src/security/credentials';

describe('account credentials', () => {
  it('accepts the true passphrase and rejects everything else', async () => {
    const stored = await hashPassphrase('correct horse battery');
    expect(await verifyPassphrase('correct horse battery', stored)).toBe(true);
    expect(await verifyPassphrase('correct horse batterY', stored)).toBe(false);
    expect(await verifyPassphrase('', stored)).toBe(false);
  });

  it('salts every credential, so two identical passphrases never share a hash', async () => {
    const a = await hashPassphrase('same-secret');
    const b = await hashPassphrase('same-secret');
    expect(a.secretSalt).not.toBe(b.secretSalt);
    expect(a.secretHash).not.toBe(b.secretHash);
    expect(await verifyPassphrase('same-secret', b)).toBe(true);
  });

  it('never stores the passphrase itself', async () => {
    const stored = await hashPassphrase('plaintext-canary');
    expect(JSON.stringify(stored)).not.toContain('plaintext-canary');
    expect(Buffer.from(stored.secretHash, 'base64')).toHaveLength(64);
  });

  it('treats a missing or corrupt credential row as a failed match, not a crash', async () => {
    expect(await verifyPassphrase('x', {})).toBe(false);
    expect(await verifyPassphrase('x', { secretSalt: 'AAAA', secretHash: 'not-base64-64-bytes' })).toBe(false);
  });

  it('normalises the handle the same way the schema does', () => {
    expect(normaliseHandle('  Rim_07 ')).toBe('rim_07');
    for (const ok of ['rim07', 'rim_07', 'a-b', 'abc']) expect(HANDLE_RE.test(ok)).toBe(true);
    for (const bad of ['ab', '_rim', 'rim 07', 'rim.07', 'a'.repeat(21), '']) expect(HANDLE_RE.test(bad)).toBe(false);
  });
});
