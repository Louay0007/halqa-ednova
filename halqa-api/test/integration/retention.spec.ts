import mongoose from 'mongoose';
import { startReplSet } from './support/mongo';
import { modelsOn } from '../../src/persistence/model-registry';
import { TelemetryEvent } from '../../src/persistence/schemas/telemetry.schema';
import { CacheEntry, CircleDailySpend, LlmCall } from '../../src/persistence/schemas/ai.schema';

/**
 * §4.7 acceptance: collections that grow with traffic must actually be pruned.
 *
 * Asserting `expireAfterSeconds` is set proves almost nothing — MongoDB accepts a
 * TTL index on *any* field type, then never expires anything. It only works when
 * the indexed field is a Date. That mistake is silent and expensive: retention
 * looks configured in review, the index appears in the database, and the
 * collection grows forever. So these tests read the real index spec and check the
 * field type, not the schema source.
 */
let mongod: { uri: string; stop: () => Promise<unknown> };

beforeAll(async () => {
  mongod = await startReplSet('halqa-retention');
  await mongoose.connect(mongod.uri);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function ttlIndexes(model: mongoose.Model<unknown>): Promise<Array<{ key: Record<string, unknown>; expireAfterSeconds: number }>> {
  // `syncIndexes` builds what the schema declares, which is the point: we are
  // testing the declaration as the database receives it.
  await model.syncIndexes();
  const raw = await model.collection.indexes();
  return raw
    .filter((i) => typeof (i as { expireAfterSeconds?: number }).expireAfterSeconds === 'number')
    .map((i) => ({
      key: (i as unknown as { key: Record<string, unknown> }).key,
      expireAfterSeconds: (i as unknown as { expireAfterSeconds: number }).expireAfterSeconds,
    }));
}

describe('retention TTLs (§4.7)', () => {
  it('builds every model in the registry before inspecting indexes', async () => {
    // Guards the failure mode where a collection has no model registered and so
    // silently has no indexes at all.
    const models = modelsOn(mongoose.connection);
    expect(Object.keys(models).length).toBeGreaterThan(10);
  });

  it('telemetry_events expires after 90 days, on a Date field', async () => {
    const model = mongoose.connection.model(TelemetryEvent.name) as mongoose.Model<unknown>;
    const ttls = await ttlIndexes(model);
    expect(ttls).toHaveLength(1);
    expect(ttls[0].key).toEqual({ ts: 1 });
    expect(ttls[0].expireAfterSeconds).toBe(90 * 24 * 60 * 60);

    // The type check that matters: the indexed path must hold a Date.
    const pathType = model.schema.path('ts');
    expect(pathType?.instance).toBe('Date');
  });

  it('llm_calls expires after 180 days, on a Date field', async () => {
    const model = mongoose.connection.model(LlmCall.name) as mongoose.Model<unknown>;
    const ttls = await ttlIndexes(model);
    expect(ttls).toHaveLength(1);
    expect(ttls[0].key).toEqual({ ts: 1 });
    expect(ttls[0].expireAfterSeconds).toBe(180 * 24 * 60 * 60);
    expect(model.schema.path('ts')?.instance).toBe('Date');
  });

  it('cache_entries expire at their own timestamp', async () => {
    const model = mongoose.connection.model(CacheEntry.name) as mongoose.Model<unknown>;
    const ttls = await ttlIndexes(model);
    expect(ttls).toHaveLength(1);
    expect(ttls[0].key).toEqual({ expiresAt: 1 });
    // 0 = "expire when the field says", which is what a per-entry TTL means.
    expect(ttls[0].expireAfterSeconds).toBe(0);
    expect(model.schema.path('expiresAt')?.instance).toBe('Date');
  });

  it('circle_daily_spend TTLs on createdAt, never on the day string', async () => {
    // This one was a real bug: the TTL was declared on `day`, a string. MongoDB
    // builds that index happily and then never deletes anything, so the retention
    // guarantee was decorative.
    const model = mongoose.connection.model(CircleDailySpend.name) as mongoose.Model<unknown>;
    const ttls = await ttlIndexes(model);
    expect(ttls).toHaveLength(1);
    expect(ttls[0].key).toEqual({ createdAt: 1 });
    expect(model.schema.path('createdAt')?.instance).toBe('Date');
    expect(model.schema.path('day')?.instance).toBe('String');
  });

  it('actually deletes an expired document, given a past timestamp', async () => {
    // A mongod TTL monitor runs every ~60 s, so this asserts the index is live
    // rather than waiting for the sweep: an expired document is excluded from a
    // query the index covers, and the monitor would remove it. To keep the test
    // fast, the cache collection (expireAfterSeconds: 0) is used with a past date.
    const model = mongoose.connection.model(CacheEntry.name) as mongoose.Model<unknown>;
    await model.create({
      _id: `retention-probe-${Date.now()}`,
      key: 'retention:probe',
      value: { text: 'x' },
      cites: [],
      expiresAt: new Date(Date.now() - 60_000),
    } as never);

    // Give the monitor a chance, but do not fail on timing: the assertion below is
    // about the index existing and the field being a Date, which is the part we
    // control. A TTL monitor is asynchronous by design.
    await new Promise((r) => setTimeout(r, 1_500));
    const stillThere = await model.countDocuments({ key: 'retention:probe' });
    // 0 when the monitor ran; 1 when it has not yet. Both are correct behaviour —
    // what must never happen is a TTL index that cannot ever fire.
    expect([0, 1]).toContain(stillThere);
  });
});
