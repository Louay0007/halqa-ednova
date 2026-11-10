import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheEntry, CacheEntryDocument, LlmCall, LlmCallDocument, QuotaLedger, QuotaLedgerDocument } from '../../persistence/schemas/ai.schema';
import { TelemetryEvent, TelemetryEventDocument } from '../../persistence/schemas/telemetry.schema';
import { OfflineService } from '../offline/offline.service';
import { RetrievalService } from '../../ai/retrieval/retrieval.service';
import { DegradationService } from '../../ai/degradation/degradation.service';

function pct(vals: number[], p: number): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/**
 * AnalyticsController — GET /metrics (plan §5.6, §8 F-ANAL).
 * Every report number is generated from here, never hand-typed:
 * callsByTier, lShare, p50/p95 per tier, cacheHitRate, peerFirstRate,
 * fallbackCounts, quotaUsage. Plus KB + offline stats for the RAG claim.
 */
@Controller()
export class AnalyticsController {
  constructor(
    @InjectModel(LlmCall.name) private readonly calls: Model<LlmCallDocument>,
    @InjectModel(CacheEntry.name) private readonly cache: Model<CacheEntryDocument>,
    @InjectModel(QuotaLedger.name) private readonly ledger: Model<QuotaLedgerDocument>,
    @InjectModel(TelemetryEvent.name) private readonly events: Model<TelemetryEventDocument>,
    private readonly offline: OfflineService,
    private readonly retrieval: RetrievalService,
    private readonly degradation: DegradationService,
  ) {}

  @Get('metrics')
  async metrics(@Query('sessionId') sessionId?: string): Promise<unknown> {
    const match = sessionId ? { sessionId } : {};
    const rows = await this.calls.find(match).lean().exec();
    const c = rows.filter((r) => r.tier === 'C');
    const l = rows.filter((r) => r.tier === 'L');
    const hits = rows.filter((r) => r.cacheHit).length;
    const latC = c.map((r) => r.latencyMs ?? 0);
    const latL = l.map((r) => r.latencyMs ?? 0);
    const total = rows.length || 1;

    const resolved = await this.events.countDocuments({ ...match, type: { $in: ['skip', 'nova_verify'] } }).exec();
    const peerFirst = await this.events
      .countDocuments({ ...match, type: 'nova_verify', 'payload.verdict': 'verified' })
      .exec()
      .catch(() => 0);
    const fallbacks = await this.events.countDocuments({ ...match, type: 'fallback_state' }).exec();
    const quotas = await this.events.countDocuments({ ...match, type: 'quota_event' }).exec();
    const ledgers = await this.ledger.find(sessionId ? { _id: sessionId } : {}).lean().exec();
    const quotaUsage = ledgers.map((g) => ({ sessionId: g._id, cUsed: g.cUsed, lUsed: g.lUsed, cCap: g.cCap, lCap: g.lCap }));

    return {
      callsByTier: { C: c.length, L: l.length, total: rows.length },
      lShare: l.length / total,
      p50: { C: pct(latC, 50), L: pct(latL, 50) },
      p95: { C: pct(latC, 95), L: pct(latL, 95) },
      cacheHitRate: hits / total,
      cacheEntries: await this.cache.countDocuments().exec(),
      peerFirstRate: resolved > 0 ? peerFirst / resolved : 0,
      fallbackCounts: { fallback_state: fallbacks, quota_event: quotas },
      quotaUsage,
      degradation: this.degradation.getMode(),
      kb: { docs: this.retrieval.docCount },
      offline: this.offline.stats(),
    };
  }
}
