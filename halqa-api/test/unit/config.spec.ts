import { loadConfig } from '../../src/core/config/app-config';

describe('config', () => {
  const base = { MONGODB_URI: 'mongodb://localhost:27017/halqa', TOKEN_SECRET: 'test-secret' };
  it('loads defaults', () => {
    const cfg = loadConfig({ ...base });
    expect(cfg.PORT).toBe(3000);
    expect(cfg.QUOTA_C).toBe(20);
    expect(cfg.QUOTA_L).toBe(5);
    expect(cfg.WINDOW_S).toBe(45);
    expect(cfg.chaosEnabled).toBe(false);
    expect(cfg.isProd).toBe(false);
  });
  it('rejects missing MONGODB_URI', () => {
    expect(() => loadConfig({ TOKEN_SECRET: 'x' })).toThrow(/MONGODB_URI/);
  });
  it('rejects missing TOKEN_SECRET', () => {
    expect(() => loadConfig({ MONGODB_URI: 'mongodb://x' })).toThrow(/TOKEN_SECRET/);
  });
  it('clamps WINDOW_S to 30..90', () => {
    expect(() => loadConfig({ ...base, WINDOW_S: '10' })).toThrow();
    expect(() => loadConfig({ ...base, WINDOW_S: '120' })).toThrow();
    expect(loadConfig({ ...base, WINDOW_S: '60' }).WINDOW_S).toBe(60);
  });
  it('parses CORS origins', () => {
    const cfg = loadConfig({ ...base, CORS_ORIGINS: 'https://a.app, https://b.app' });
    expect(cfg.corsOrigins).toEqual(['https://a.app', 'https://b.app']);
  });
});
