import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { APP_CONFIG } from '../../core/config/config.module';
import type { AppConfig } from '../../core/config/app-config';
import { LlmPort, LlmRequest, LlmResult, LlmStep } from '../../domain/ports/llm-port';
import { LlmCall, LlmCallDocument } from '../../persistence/schemas/ai.schema';

/**
 * THE ONLY file that knows model names/keys. Providers are swapped via env
 * vars (PROVIDER_BASE_URL, PROVIDER_API_KEY, COMPACT_MODEL, LARGER_MODEL).
 * Nothing outside src/ai may import it — enforced by an architectural test.
 *
 * Transport: OpenAI-compatible `POST {base}/v1/chat/completions`.
 * The configured models are reasoning models: they spend most of
 * `max_tokens` on reasoning before emitting content, so the request budget
 * is scaled up from the caller's `maxTokens` (the caller's value remains
 * the *output* contract; the budget covers reasoning + output).
 *
 * No stub path: without key/base/model every call throws
 * PROVIDER_NOT_CONFIGURED and the caller's fallback path (governor deny →
 * offline pack) engages. Tests override this provider with a scripted stub.
 *
 * Every call is persisted to `llm_calls` HERE (not via interceptor), so no
 * code path can bypass metering. Prompts are never stored (PII risk); only
 * step/tier/tokens/latency/cache/fallback metadata.
 */
@Injectable()
export class ProviderAdapter implements LlmPort {
  private readonly logger = new Logger(ProviderAdapter.name);

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectModel(LlmCall.name) private readonly calls: Model<LlmCallDocument>,
  ) {}

  get compactModel(): string {
    return this.cfg.COMPACT_MODEL;
  }

  get largerModel(): string {
    return this.cfg.LARGER_MODEL;
  }

  async compact(req: LlmRequest): Promise<LlmResult> {
    return this.execute('C', req, () => this.callProvider(this.cfg.COMPACT_MODEL, req));
  }

  async larger(req: LlmRequest): Promise<LlmResult> {
    return this.execute('L', req, () => this.callProvider(this.cfg.LARGER_MODEL, req));
  }

  async available(tier: 'C' | 'L'): Promise<boolean> {
    const key = this.cfg.PROVIDER_API_KEY.length > 0 && this.cfg.PROVIDER_BASE_URL.length > 0;
    if (!key) return false;
    return tier === 'C' ? this.cfg.COMPACT_MODEL.length > 0 : this.cfg.LARGER_MODEL.length > 0;
  }

  private async execute(
    tier: 'C' | 'L',
    req: LlmRequest,
    run: () => Promise<Omit<LlmResult, 'cached'>>,
  ): Promise<LlmResult> {
    const started = Date.now();
    try {
      const out = await run();
      const result: LlmResult = { ...out, cached: false };
      await this.logCall({ step: req.step, tier, result, ok: true });
      return result;
    } catch (err) {
      await this.logCall({
        step: req.step,
        tier,
        result: { text: '', tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started, cached: false },
        ok: false,
        errorCode: err instanceof Error ? err.message.slice(0, 80) : 'UNKNOWN',
      });
      throw err;
    }
  }

  private async callProvider(model: string, req: LlmRequest): Promise<Omit<LlmResult, 'cached'>> {
    const base = this.cfg.PROVIDER_BASE_URL.replace(/\/$/, '');
    const key = this.cfg.PROVIDER_API_KEY;
    if (!key || !base || !model) throw new Error('PROVIDER_NOT_CONFIGURED');
    // Reasoning models burn budget on thinking: scale the caller's output
    // contract up so the response reaches `stop` instead of `length`.
    const budget = Math.max(1500, req.maxTokens * 6);
    const started = Date.now();
    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.prompt });
    let res: Response;
    try {
      res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: budget }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (e) {
      throw new Error(`PROVIDER_TRANSPORT:${(e as Error).name}`);
    }
    if (!res.ok) throw new Error(`PROVIDER_HTTP_${res.status}`);
    const j = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = j.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error(`PROVIDER_EMPTY_COMPLETION:${j.choices?.[0]?.finish_reason ?? 'unknown'}`);
    }
    return {
      text: text.trim(),
      tokensIn: j.usage?.prompt_tokens ?? 0,
      tokensOut: j.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }

  private async logCall(args: {
    step: LlmStep;
    tier: 'C' | 'L';
    result: LlmResult;
    ok: boolean;
    errorCode?: string;
    sessionId?: string;
    cacheHit?: boolean;
    fallbackUsed?: string | null;
  }): Promise<void> {
    try {
      await this.calls.create({
        ts: new Date(),
        sessionId: args.sessionId,
        step: args.step,
        tier: args.tier,
        tokensIn: args.result.tokensIn,
        tokensOut: args.result.tokensOut,
        latencyMs: args.result.latencyMs,
        cacheHit: args.cacheHit ?? false,
        fallbackUsed: args.fallbackUsed ?? null,
        ok: args.ok,
        errorCode: args.errorCode,
      });
    } catch (e) {
      // Metering must never break the request path.
      this.logger.warn(`llm_calls write failed: ${(e as Error).message}`);
    }
  }

  /** Used by the router to record a served-from-cache turn without a model call,
   *  so the cache-hit-rate metric stays honest (plan §6.5). */
  async logCacheHit(step: LlmStep, sessionId: string): Promise<void> {
    await this.logCall({
      step,
      tier: 'C',
      result: { text: '', tokensIn: 0, tokensOut: 0, latencyMs: 0, cached: true },
      ok: true,
      sessionId,
      cacheHit: true,
    });
  }
}
