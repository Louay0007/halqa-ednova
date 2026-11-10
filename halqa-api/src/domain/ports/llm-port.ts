export interface LlmResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  cached: boolean;
}

export interface LlmRequest {
  step: LlmStep;
  prompt: string;
  system?: string;
  maxTokens: number;
  schema?: unknown;
  signal?: AbortSignal;
}

export type LlmStep =
  | 'group_pulse'
  | 'quick_take'
  | 'deep_dive'
  | 'hint'
  | 'auditor'
  | 'capsule'
  | 'capsule_polish'
  | 'mentor_brief'
  | 'whisper_compare'
  | 'solo_turn'
  | 'question_coach';

/** Injection token for the single LlmPort implementation. Feature modules
 *  depend on this token (never on the concrete adapter file). */
export const LLM_PORT = Symbol('LLM_PORT');

/** The single port every AI consumer depends on. Implemented ONLY by
 *  src/ai/adapter/provider.adapter.ts — the one file that knows model
 *  names/keys. A test asserts no other module imports the adapter. */
export interface LlmPort {
  compact(req: LlmRequest): Promise<LlmResult>;
  larger(req: LlmRequest): Promise<LlmResult>;
  available(tier: 'C' | 'L'): Promise<boolean>;
  /** Record a served-from-cache turn so the hit-rate metric stays honest. */
  logCacheHit(step: LlmStep, sessionId: string): Promise<void>;
}
