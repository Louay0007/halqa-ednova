/* HALQA v2 — typed API client (plan §8.2 lib/api.ts).
   All 35+ backend routes. fetch only, no query lib: ETag/304 + asker-only
   semantics stay explicit per screen. Token in sessionStorage, never local. */

/**
 * The API base is required in a production bundle. Falling back to localhost
 * there is worse than failing to build: every request would point at the
 * learner's own machine and surface as an opaque network error. The build-time
 * guard lives in vite.config.ts; this is the runtime backstop for anyone who
 * imports the module outside Vite (tests, scripts).
 */
const RAW_BASE = import.meta.env.VITE_API_BASE as string | undefined;
if (import.meta.env.PROD && !RAW_BASE) {
  throw new Error('VITE_API_BASE is required for a production build (see .env.example).');
}
const BASE = RAW_BASE ?? 'http://localhost:3000/api/v1';

export type Lang = 'ar' | 'darija' | 'fr' | 'en';
export type ContextMode = 'class' | 'study' | 'community' | 'workshop' | 'program' | 'solo';
export type DegradationMode = 'green' | 'orange' | 'red' | 'black';

/** The coach rephrase `style` enum — the backend's `RephraseDto` whitelists exactly
 *  these six and has no `@IsOptional`, so this is the only valid value set. */
export const REWRITE_STYLES = ['visual', 'analogy', 'steps', 'example', 'repetition', 'practice'] as const;
export type RewriteStyle = (typeof REWRITE_STYLES)[number];

export interface ApiError {
  error: string;
  code: string;
  retryable: boolean;
  user_msg: Record<Lang, string>;
  requestId?: string;
}

export class ApiFailure extends Error {
  status: number;
  body: ApiError;
  constructor(status: number, body: ApiError) {
    super(body.code || `HTTP_${status}`);
    this.status = status;
    this.body = body;
  }
}

const TOKEN_KEY = 'halqa.token';
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY) ?? '',
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

/**
 * A 401 means the server no longer honours the stored token (expired, or the
 * learner signed out elsewhere and the epoch moved). Keeping it would leave every
 * screen silently broken, so drop it and bounce to the entry screen.
 * `SessionProvider` overrides this to stay inside the router instead of reloading.
 */
let onUnauthorized: () => void = () => {
  tokenStore.clear();
  if (!window.location.pathname.startsWith('/enter')) window.location.assign('/enter');
};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

/** Device clock minus server clock, learned from the `Date` response header. */
let clockSkewMs = 0;
const skewSeen = () => clockSkewMs !== 0;
export const clockSkew = () => clockSkewMs;

/** Non-AI routes answer in milliseconds; AI routes are provider-bound and the
 *  quota governor degrades them server-side, so they get a longer leash. */
const TIMEOUT_MS = 10_000;
const AI_TIMEOUT_MS = 30_000;
const AI_PATH = /^\/(coach|hints|capsule|whisper|solo|questions\/[^/]+\/(peer-answer|hint)|quiz)/;
const timeoutFor = (path: string) => (AI_PATH.test(path) ? AI_TIMEOUT_MS : TIMEOUT_MS);

/** Idempotent GETs are safe to repeat; writes never are. */
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const isNetworkError = (e: unknown) => e instanceof TypeError;

export interface ReqOptions extends RequestInit {
  etag?: string;
  /** Caller-owned cancellation (route unmount, poller superseded). */
  signal?: AbortSignal;
  /** Override the retry budget; GETs default to 2 retries, writes to 0. */
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function req<T>(path: string, init?: ReqOptions): Promise<{ data: T; etag: string | null; notModified: boolean }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.etag) headers['If-None-Match'] = init.etag;

  const method = (init?.method ?? 'GET').toUpperCase();
  const budget = init?.retries ?? (method === 'GET' ? 2 : 0);

  for (let attempt = 0; ; attempt++) {
    // A per-attempt timeout that also honours the caller's signal: aborting
    // either one cancels the fetch, and a caller abort must not be retried.
    const timeout = AbortSignal.timeout(timeoutFor(path));
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, { ...init, headers, signal });
    } catch (e) {
      // Caller cancelled (navigated away): propagate quietly, never retry.
      if (init?.signal?.aborted) throw e;
      if (attempt < budget && isNetworkError(e)) {
        await sleep(250 * 2 ** attempt + Math.random() * 100);
        continue;
      }
      throw new ApiTimeout(path, timeout.aborted);
    }

    if (attempt < budget && RETRYABLE_STATUS.has(res.status)) {
      await sleep(250 * 2 ** attempt + Math.random() * 100);
      continue;
    }

    // The server never sends `now` (it would churn ETags), so the countdown needs
    // the offset from this header instead — once is enough for a session.
    const serverDate = res.headers.get('Date');
    if (!skewSeen() && serverDate) {
      const ms = Date.parse(serverDate);
      if (!Number.isNaN(ms)) clockSkewMs = Date.now() - ms;
    }
    const etag = res.headers.get('ETag');
    if (res.status === 304) return { data: undefined as T, etag, notModified: true };
    const body = (await res.json().catch(() => ({}))) as T & ApiError;
    if (res.status === 401 && token) {
      tokenStore.clear();
      onUnauthorized();
    }
    if (!res.ok) throw new ApiFailure(res.status, body as ApiError);
    return { data: body as T, etag, notModified: false };
  }
}

/** A timeout or unfetchable network error. Distinguishable from `ApiFailure`
 *  (the server answered with an error) so the UI can say "can't reach HALQA"
 *  instead of rendering a server message that never arrived. */
export class ApiTimeout extends Error {
  readonly timedOut: boolean;
  constructor(path: string, timedOut: boolean) {
    super(timedOut ? `Request to ${path} timed out` : `Request to ${path} failed to reach the network`);
    this.name = 'ApiTimeout';
    this.timedOut = timedOut;
  }
}

const get = <T>(p: string, etag?: string, signal?: AbortSignal) => req<T>(p, { method: 'GET', etag, signal }).then((r) => r);
const post = <T>(p: string, body?: unknown, signal?: AbortSignal) =>
  req<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), signal }).then((r) => r.data);
const patch = <T>(p: string, body: unknown, signal?: AbortSignal) =>
  req<T>(p, { method: 'PATCH', body: JSON.stringify(body), signal }).then((r) => r.data);

/* platform */
export const api = {
  healthz: () => get<{ ok: boolean; uptimeS: number }>('/healthz'),
  readyz: () => get<{ ok: boolean; mongo: string }>('/readyz'),
  kbStats: () => get<{ docs: number; topics: string[] }>('/kb/stats'),
  kbChunks: (topic?: string, lang?: string) =>
    get<{ chunks: Array<{ chunk_id: string; topic: string; lang: string; kind: string; title: string; text: string; claims: string[] }> }>(
      `/kb/chunks${topic ? `?topic=${topic}${lang ? `&lang=${lang}` : ''}` : ''}`,
    ),
  metrics: (sessionId?: string) => get<Metrics>(`/metrics${sessionId ? `?sessionId=${sessionId}` : ''}`),
  degradation: () => get<{ mode: DegradationMode }>('/degradation'),
  chaos: (mode: DegradationMode) => post<{ mode: DegradationMode }>('/chaos', { mode }),
  events: (sessionId: string, limit = 200) => get<Array<{ ts: string; actor: string; type: string; payload: Record<string, unknown> }>>(`/telemetry/sessions/${sessionId}/events?limit=${limit}`),

  /* identity + dna */
  authSession: (nickname: string, context: ContextMode, avatarKey?: string) =>
    post<{ token: string; learner: { id: string; nickname: string; avatarKey: string; handle: string | null } }>('/auth/session', { nickname, context, avatarKey }),
  /** Turn the current (usually guest) record into an account: handle + passphrase. */
  register: (input: { handle: string; passphrase: string; nickname?: string; avatarKey?: string; context?: ContextMode }) =>
    post<{ token: string; learner: { id: string; nickname: string; avatarKey: string; handle: string | null } }>('/auth/register', input),
  /** Sign back in from any device. */
  login: (handle: string, passphrase: string) =>
    post<{ token: string; learner: { id: string; nickname: string; avatarKey: string; handle: string | null } }>('/auth/login', { handle, passphrase }),
  /** Rotate the secret; returns a fresh token because the epoch bumps. */
  changePassphrase: (current: string, next: string) => post<{ token: string }>('/auth/passphrase', { current, next }),
  me: () => get<{ learner: unknown; passport: Passport | null }>('/me'),
  /** Update avatar / context on the caller's own record. The backend DTO
   *  whitelists exactly these two fields, and `forbidNonWhitelisted` rejects
   *  anything else, so the parameter type is deliberately narrow. */
  updateMe: (input: { avatarKey?: string; context?: ContextMode }) =>
    patch<{ id: string; nickname: string; avatarKey: string; context: string; handle: string | null }>('/me', input),
  dnaItems: () =>
    get<{ items: Array<{ id: string; prompt: string; options: Array<{ value: string; label: string }> }> }>(
      '/dna/items',
    ),
  dna: (input: { nickname?: string; context?: string; topic?: string; answers: Record<string, string>; sessionId?: string; circleId?: string }) =>
    post<{ learnerId: string; passport: Passport }>('/dna', input),
  explainCard: (learnerId: string) => get<{ card: string; visible: boolean }>(`/passports/${learnerId}/explain-card`),
  signout: () => post<{ ok: true }>('/auth/signout'),

  /* circles + sessions */
  circleCreate: (input: { topic: string; context: ContextMode; lang: Lang; title?: string; windowS?: number; hostNickname: string }) =>
    post<{ circleId: string; joinCode: string; hostLearnerId: string; token: string }>('/circles', input),
  circleJoin: (circleId: string, nickname: string, learnerId?: string) => post<{ learnerId: string; role: string; token: string }>(`/circles/${circleId}/join`, { nickname, learnerId }),
  /** Public context capabilities: agenda template, matcher/mentor-board flags,
   *  bandwidth. `/circles/new` previews the agenda from this instead of hardcoding
   *  the five steps, so a context that drops a step stops advertising it. */
  contextConfig: (mode: ContextMode) =>
    get<{
      agenda: Array<{ id: string; kind: string; plannedS?: number }>;
      matcher: boolean;
      mentorBoard: boolean;
      spacedRepetition: boolean;
      bandwidth: string;
    }>(`/contexts/${mode}/config`),
  circleByCode: (code: string) => get<{ circleId: string; topic: string; members: number }>(`/circles/by-code/${encodeURIComponent(code.trim().toUpperCase())}`),
  circleGet: (circleId: string, signal?: AbortSignal) =>
    get<{ _id: string; topic: string; context: ContextMode; members: Array<{ learnerId: string; role: string; nickname?: string }>; joinCode: string; windowS: number }>(`/circles/${circleId}`, undefined, signal),
  circleHealth: (circleId: string, signal?: AbortSignal) => get<Health>(`/circles/${circleId}/health`, undefined, signal),
  sessionStart: (circleId: string) => post<{ sessionId: string }>(`/circles/${circleId}/sessions`),
  sessionEnd: (sessionId: string) => post<{ endedAt: string; health: unknown; credits: unknown; usage: unknown }>(`/sessions/${sessionId}/end`),
  /* No client for `GET /sessions/:id/credits`: its `dominant` field is a
     private dominance signal ("never exposed publicly" in equity.service),
     and `sessionGet` already carries the credits array the UI renders. */
  sessionGet: (sessionId: string) =>
    get<{ _id: string; agenda?: { templateId: string; steps: Array<{ id: string; kind: string; plannedS?: number; done: boolean }> }; credits?: Array<{ learnerId: string; total: number }> }>(`/sessions/${sessionId}`),

  /* coach (private, per-member) */
  coachNudge: (targetId: string, input: { sessionId: string; circleId: string }) =>
    post<{ nudge: string; private: true }>(`/coach/nudge/${targetId}`, input),
  /** `style` is required by the API (`RephraseDto` has no `@IsOptional`): omitting it
   *  is an instant 400, so the type refuses to compile without one. */
  coachRephrase: (input: { sessionId: string; circleId: string; text: string; style: RewriteStyle; lang?: Lang }) =>
    post<{ suggestion: string }>('/coach/rephrase', input),

  /* questions (CF-AS) */
  questionList: (sessionId: string, signal?: AbortSignal) =>
    get<{ qids: string[] }>(`/questions?sessionId=${encodeURIComponent(sessionId)}`, undefined, signal),
  questionCreate: (input: { sessionId: string; askerId: string; text: string; lang?: Lang; anonymous?: boolean }) =>
    post<{ qid: string; state: string; windowS: number; windowEndsAt?: string }>('/questions', input),
  /** Shared poller view — has no asker-only field, so every peer gets one ETag. */
  questionState: (qid: string, etag?: string, signal?: AbortSignal) =>
    get<QuestionState>(`/questions/${qid}/state`, etag, signal),
  /** Asker-only extras. 403s for anyone who did not ask the question. */
  questionPrivate: (qid: string) =>
    get<{
      stages: Array<{ stage: string; startedAt?: string; doneAt?: string }>;
      quickTakeReady: boolean;
      deepDiveReady: boolean;
      deepDive?: { text: string; cites: string[] };
    }>(`/questions/${qid}/private`),
  peerAnswer: (qid: string, authorId: string, text: string) => post<{ aid: string; creditsAwarded: number }>(`/questions/${qid}/peer-answer`, { authorId, text }),
  meToo: (qid: string, learnerId: string) => post<{ ok: boolean }>(`/questions/${qid}/me-too`, { learnerId }),
  skip: (qid: string, askerId: string) => post<{ answer: string; tierUsed: string; cached: boolean; cites: string[] }>(`/questions/${qid}/skip`, { askerId }),
  hint: (qid: string, askerId: string, level: number) => post<{ hint: string; level: number; cites: string[] }>(`/questions/${qid}/hint`, { askerId, level }),

  /* consensus */
  pollVote: (pid: string, learnerId: string, choice: string) => post<{ tally: Record<string, number>; total: number }>(`/polls/${pid}/vote`, { learnerId, choice }),
  pollClose: (pid: string) => post<{ tally: Record<string, number>; winner: string }>(`/polls/${pid}/close`),

  /* outputs */
  capsuleBuild: (sessionId: string) => post<Capsule>(`/sessions/${sessionId}/capsule`),
  quizBattle: (circleId: string, sessionId: string, level?: string) =>
    post<{ bid: string; items: Array<{ qid: string; stem: string; choices: Array<{ key: string; text: string }> }> }>(
      '/quiz/battle',
      { circleId, sessionId, level },
    ),
  quizAnswer: (bid: string, input: { sessionId: string; circleId: string; learnerId: string; qid: string; choice: string }) =>
    post<{ correct: boolean; explain: string; xp: number }>(`/quiz/battle/${bid}/answer`, input),
  whisper: (input: { sessionId: string; circleId: string; topic: string; steps: Array<{ authorId: string; text: string }> }) =>
    post<{ chainId: string; steps: unknown[]; driftMap: { kept: string[]; lost: string[]; distorted: string[]; added: string[] }; tier: string }>('/whisper', input),
  whisperRepair: (cid: string, input: { sessionId: string; circleId: string; text: string }) => post<{ coverage: number }>(`/whisper/${cid}/repair`, input),

  /* solo */
  soloStart: (topic: string, lang: Lang, learnerId: string) => post<{ sessionId: string; hat: string; probe: string }>('/solo/sessions', { topic, lang, learnerId }),
  soloTurn: (sid: string, learnerId: string, text: string, lang?: Lang) => post<{ novaTurn: string; progress: number }>(`/solo/sessions/${sid}/turn`, { learnerId, text, lang }),
  soloHat: (sid: string, hat: string) => post<{ hat: string }>(`/solo/sessions/${sid}/hat`, { hat }),
  soloInvite: (sid: string) => post<{ deepLink: string; code: string }>(`/solo/sessions/${sid}/invite`),

  /* people */
  match: (nicknames: string[], seed?: number) => post<{ seed: number; groups: Array<{ circleId: string; learnerIds: string[]; rationale: string }> }>('/circles/match', { nicknames, seed }),
  board: (topic?: string) => get<{ circles: Array<{ id: string; topic: string; S?: number; B?: number; U?: number; needsHuman?: boolean; noSession?: boolean }> }>(`/board${topic ? `?topic=${topic}` : ''}`),
  mentorJoin: (circleId: string, mentorId: string) => post<{ ok: boolean; role: string }>(`/circles/${circleId}/mentor/join`, { mentorId }),
  mentorNote: (circleId: string, mentorId: string, text: string, sessionId?: string) => post<{ noteId: string }>('/mentor/notes', { circleId, mentorId, text, sessionId }),
  /** Both params are mandatory server-side (`assertMember` runs on each), and an
   *  empty `sessionId=` reaches it as a string that matches nothing — so refuse the
   *  call here rather than sending a request that can only 403. */
  mentorBrief: (circleId: string, sessionId: string) => {
    if (!circleId || !sessionId) return Promise.reject(new Error('mentorBrief needs circleId and sessionId'));
    return get<{ brief: string; words: number }>(
      `/mentor/brief?circleId=${encodeURIComponent(circleId)}&sessionId=${encodeURIComponent(sessionId)}`,
    );
  },
  dashboard: (circleId?: string) => get<{ sessions: Array<{ sessionId: string; health: { S: number; B: number; U: number; needsHuman: boolean } | null; talkShare: Array<{ learnerId: string; total: number }>; stuck: boolean }>; styleMix: Record<string, number>; aggregatesOnly: boolean }>(`/dashboard${circleId ? `?circleId=${circleId}` : ''}`),
  /** Own progress only — the API no longer exposes another learner's XP (§3.5). */
  progress: () =>
    get<{ xp: number; total: number; badges: string[]; streakDays: number }>('/learners/me/progress'),
};

export interface Passport {
  level: string;
  levelByTopic: Record<string, string>;
  styleWeights: Record<string, number>;
  lang: Lang;
  hintEagerness: number;
  inviteMe: boolean;
  explainCardVisible: boolean;
}

export interface Health {
  sessionId: string;
  S: number;
  B: number;
  U: number;
  tiers: { S: string; B: string; U: string };
  credits: Array<{ learnerId: string; total: number }>;
  needsHuman: boolean;
}

export interface QuestionState {
  qid: string;
  state: 'OPEN' | 'NOVA_THINKING' | 'RESOLVED';
  text?: string;
  peerCount: number;
  windowS: number;
  windowEndsAt?: string;
  resolution?: string;
  peerFirst?: boolean;
  answer?: { text: string; cites: string[]; kind: string; tierUsed?: string; cached?: boolean; truncated?: boolean };
  stages?: Array<{ stage: string; startedAt?: string; doneAt?: string }>;
  quickTakeReady?: boolean;
  deepDiveReady?: boolean;
  deepDive?: { text: string; cites: string[] };
  pollId?: string;
}

export interface Capsule {
  bullets: string[];
  visual_desc: string;
  mini_quiz: string[];
  next_step: string;
  xp_earned: number;
  tier: string;
}

export interface Metrics {
  callsByTier: { C: number; L: number; total: number };
  lShare: number;
  p50: { C: number; L: number };
  p95: { C: number; L: number };
  cacheHitRate: number;
  peerFirstRate: number;
  fallbackCounts: Record<string, number>;
  quotaUsage: Array<{ sessionId: string; cUsed: number; lUsed: number; cCap: number; lCap: number }>;
  degradation: DegradationMode;
  kb: { docs: number };
  offline: { snippets: number };
}
