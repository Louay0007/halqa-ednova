import { CONFIDENCE_THRESHOLD, decideEscalation, emptyPulse, parsePulse, retrievalConflict } from '../../src/ai/router/router.service';

describe('router pure: parsePulse', () => {
  it('parses valid Group Pulse JSON with high confidence', () => {
    const { pulse, confidence } = parsePulse(
      '{"intent":"explain","helpful_0_2":2,"bridging_bool":true,"skeptic_bool":false,"confusion_0_1":0,"lang":"fr"}',
      'fr',
    );
    expect(pulse).toMatchObject({ intent: 'explain', helpful_0_2: 2, bridging_bool: true, lang: 'fr' });
    expect(confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });
  it('tolerates code fences', () => {
    const { pulse } = parsePulse('```json\n{"intent":"ask","lang":"ar"}\n```', 'ar');
    expect(pulse.intent).toBe('ask');
    expect(pulse.lang).toBe('ar');
  });
  it('falls back to emptyPulse with low confidence on garbage', () => {
    const { pulse, confidence } = parsePulse('COMPACT_RESPONSE_group_pulse', 'en');
    expect(pulse).toEqual(emptyPulse('en'));
    expect(confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
  });
  it('clamps out-of-range fields', () => {
    const { pulse } = parsePulse('{"intent":"bogus","helpful_0_2":9,"confusion_0_1":-2}', 'en');
    expect(pulse.intent).toBe('chitchat');
    expect(pulse.helpful_0_2).toBe(2);
    expect(pulse.confusion_0_1).toBe(0);
  });
});

describe('router pure: decideEscalation', () => {
  const base = { confidence: 0.85, chunkCount: 1 };
  it('stays on C for a clean routine turn', () => {
    expect(decideEscalation(base)).toBe(false);
  });
  it('escalates on low C confidence', () => {
    expect(decideEscalation({ ...base, confidence: 0.4 })).toBe(true);
  });
  it('escalates when ≥3 chunks AND conflict, not on count alone', () => {
    expect(decideEscalation({ ...base, chunkCount: 3 })).toBe(false);
    expect(decideEscalation({ ...base, chunkCount: 3, conflict: true })).toBe(true);
    expect(decideEscalation({ ...base, chunkCount: 2, conflict: true })).toBe(false);
  });
  it('escalates on polished-prose flag or auditor escalation', () => {
    expect(decideEscalation({ ...base, needsPolishedProse: true })).toBe(true);
    expect(decideEscalation({ ...base, auditorEscalated: true })).toBe(true);
  });
});

describe('router pure: retrievalConflict', () => {
  it('fires on a misconception chunk in play', () => {
    expect(retrievalConflict([{ score: 5, kind: 'lesson' }, { score: 1, kind: 'misconception' }])).toBe(true);
  });
  it('fires on a thin top margin (<5%), not on a clear winner', () => {
    expect(retrievalConflict([{ score: 1.0 }, { score: 0.97 }])).toBe(true);
    expect(retrievalConflict([{ score: 1.0 }, { score: 0.5 }])).toBe(false);
  });
  it('needs at least 2 hits for a margin signal', () => {
    expect(retrievalConflict([{ score: 1.0 }])).toBe(false);
    expect(retrievalConflict([])).toBe(false);
  });
});
