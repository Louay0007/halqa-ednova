import { USER_MESSAGES, userMessageFor } from '../../src/common/user-messages';
import { apiError } from '../../src/common/types/api-error';

const LANGS = ['ar', 'darija', 'fr', 'en'] as const;

describe('learner-facing error messages', () => {
  it('every row carries all four languages', () => {
    const missing = Object.entries(USER_MESSAGES).flatMap(([code, msg]) =>
      LANGS.filter((l) => !msg[l]?.trim()).map((l) => `${code}.${l}`),
    );
    expect(missing).toEqual([]);
  });

  it('no language silently falls back to the English string', () => {
    // The bug this table exists to fix: apiError copied `en` into every other slot.
    const fallen = Object.entries(USER_MESSAGES).flatMap(([code, msg]) =>
      LANGS.filter((l) => l !== 'en' && msg[l] === msg.en).map((l) => `${code}.${l}`),
    );
    expect(fallen).toEqual([]);
  });

  it('ar/darija are actually written in Arabic script', () => {
    const latin = Object.entries(USER_MESSAGES).flatMap(([code, msg]) =>
      (['ar', 'darija'] as const).filter((l) => !/[\u0600-\u06FF]/.test(msg[l])).map((l) => `${code}.${l}`),
    );
    expect(latin).toEqual([]);
  });

  it('resolves a code that carries a :detail suffix', () => {
    expect(userMessageFor('SESSION_NOT_FOUND:S-abc', 404, 'SESSION_NOT_FOUND:S-abc').fr).toBe(
      USER_MESSAGES.SESSION_NOT_FOUND.fr,
    );
    expect(userMessageFor('POLL_BAD_CHOICE:correct', 400, 'POLL_BAD_CHOICE:correct').darija).toBe(
      USER_MESSAGES.POLL_BAD_CHOICE.darija,
    );
  });

  it('keeps the English detail for unknown 4xx instead of inventing a translation', () => {
    const m = userMessageFor('HTTP_400', 400, 'topic must be a string');
    expect(m.en).toBe('topic must be a string');
    expect(m.fr).toBe('topic must be a string');
  });

  it('uses a generic sentence for 5xx (never leaks internals)', () => {
    const m = userMessageFor('INTERNAL', 500, 'MongoServerError: connection refused');
    for (const l of LANGS) expect(m[l]).not.toContain('Mongo');
    expect(m.fr).not.toBe(m.en);
  });

  it('uses the rate-limit sentence for 429', () => {
    const m = userMessageFor('HTTP_429', 429, 'Too Many Requests');
    expect(m.ar).not.toBe(m.en);
    expect(m.darija).not.toBe(m.en);
  });

  it('apiError surfaces the table, not just English', () => {
    const body = apiError('Denied', 'HINT_ASKER_ONLY', false, userMessageFor('HINT_ASKER_ONLY', 403, 'HINT_ASKER_ONLY'));
    expect(body.user_msg.ar).toBe(USER_MESSAGES.HINT_ASKER_ONLY.ar);
    expect(body.user_msg.fr).toBe(USER_MESSAGES.HINT_ASKER_ONLY.fr);
    expect(body.code).toBe('HINT_ASKER_ONLY');
  });
});
