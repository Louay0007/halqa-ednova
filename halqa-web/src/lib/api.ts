/* HALQA v2 — typed API client (plan §8.2 lib/api.ts).
   All 35+ backend routes. fetch only, no query lib: ETag/304 + asker-only
   semantics stay explicit per screen. Token in sessionStorage, never local. */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3000/api/v1';

export type Lang = 'ar' | 'darija' | 'fr' | 'en';
export type ContextMode = 'class' | 'study' | 'community' | 'workshop' | 'program' | 'solo';
export type DegradationMode = 'green' | 'orange' | 'red' | 'black';

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

async function req<T>(path: string, init?: RequestInit & { etag?: string }): Promise<{ data: T; etag: string | null; notModified: boolean }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.etag) headers['If-None-Match'] = init.etag;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const etag = res.headers.get('ETag');
  if (res.status === 304) return { data: undefined as T, etag, notModified: true };
  const body = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) throw new ApiFailure(res.status, body as ApiError);
  return { data: body as T, etag, notModified: false };
}

const get = <T>(p: string, etag?: string) => req<T>(p, { method: 'GET', etag }).then((r) => r);
const post = <T>(p: string, body?: unknown) => req<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }).then((r) => r.data);

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
    post<{ token: string; learner: { id: string; nickname: string; avatarKey: string } }>('/auth/session', { nickname, context, avatarKey }),
  me: () => get<{ learner: unknown; passport: Passport | null }>('/me'),
  dnaItems: () => get<{ items: Array<{ id: string; prompt: string; options: string[] }> }>('/dna/items'),
  dna: (input: { nickname: string; context: string; topic?: string; answers: Record<string, string>; sessionId?: string; circleId?: string }) =>
    post<{ learnerId: string; passport: Passport }>('/dna', input),
  explainCard: (learnerId: string) => get<{ card: string; visible: boolean }>(`/passports/${learnerId}/explain-card`),

  /* circles + sessions */
  contexts: (mode: ContextMode) => get<{ agenda: Array<{ id: string; kind: string; plannedS: number }>; matcher: boolean; mentorBoard: boolean; spacedRepetition: boolean; bandwidth: string }>(`/contexts/${mode}/config`),
  circleCreate: (input: { topic: string; context: ContextMode; lang: Lang; title?: string; windowS?: number; hostNickname: string }) =>
    post<{ circleId: string; joinCode: string; hostLearnerId: string; token: string }>('/circles', input),
  circleJoin: (circleId: string, nickname: string) => post<{ learnerId: string; role: string; token: string }>(`/circles/${circleId}/join`, { nickname }),
  circleByCode: (code: string) => get<{ circleId: string; topic: string; members: number }>(`/circles/by-code/${encodeURIComponent(code.trim().toUpperCase())}`),
  circleGet: (circleId: string) => get<{ _id: string; topic: string; members: Array<{ learnerId: string; role: string; nickname?: string }>; joinCode: string; windowS: number }>(`/circles/${circleId}`),
  circleHealth: (circleId: string) => get<Health>(`/circles/${circleId}/health`),
  sessionStart: (circleId: string) => post<{ sessionId: string }>(`/circles/${circleId}/sessions`),
  sessionGet: (sessionId: string) => get<{ _id: string; agenda: { steps: Array<{ id: string; kind: string; done: boolean }> }; credits: Array<{ learnerId: string; total: number }> }>(`/sessions/${sessionId}`),
  sessionEnd: (sessionId: string) => post<{ endedAt: string; health: unknown; credits: unknown; usage: unknown }>(`/sessions/${sessionId}/end`),
  sessionCredits: (sessionId: string) => get<{ credits: Array<{ learnerId: string; total: number }>; dispersion: number; dominant: unknown }>(`/sessions/${sessionId}/credits`),

  /* questions (CF-AS) */
  questionList: (sessionId: string) => get<{ qids: string[] }>(`/questions?sessionId=${encodeURIComponent(sessionId)}`),
  questionCreate: (input: { sessionId: string; askerId: string; text: string; lang?: Lang; anonymous?: boolean }) =>
    post<{ qid: string; state: string; windowS: number; windowEndsAt?: string }>('/questions', input),
  questionState: (qid: string, asker?: string, etag?: string) => get<QuestionState>(`/questions/${qid}/state${asker ? `?asker=${asker}` : ''}`, etag),
  peerAnswer: (qid: string, authorId: string, text: string) => post<{ aid: string; creditsAwarded: number }>(`/questions/${qid}/peer-answer`, { authorId, text }),
  meToo: (qid: string, learnerId: string) => post<{ ok: boolean }>(`/questions/${qid}/me-too`, { learnerId }),
  skip: (qid: string, askerId: string) => post<{ answer: string; tierUsed: string; cached: boolean; cites: string[] }>(`/questions/${qid}/skip`, { askerId }),
  hint: (qid: string, askerId: string, level: number) => post<{ hint: string; level: number; cites: string[] }>(`/questions/${qid}/hint`, { askerId, level }),

  /* consensus */
  pollCreate: (input: { questionId?: string; sessionId?: string; claim: string; choices: string[]; reason?: string }) => post<{ pid: string }>('/polls', input),
  pollVote: (pid: string, learnerId: string, choice: string) => post<{ tally: Record<string, number>; total: number }>(`/polls/${pid}/vote`, { learnerId, choice }),
  pollClose: (pid: string) => post<{ tally: Record<string, number>; winner: string }>(`/polls/${pid}/close`),

  /* outputs */
  capsuleBuild: (sessionId: string) => post<Capsule>(`/sessions/${sessionId}/capsule`),
  capsuleGet: (sessionId: string) => get<Capsule>(`/sessions/${sessionId}/capsule`),
  quizBattle: (circleId: string, sessionId: string, level?: string) => post<{ bid: string; items: Array<{ qid: string; stem: string; choices: string[] }> }>('/quiz/battle', { circleId, sessionId, level }),
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
  mentorBrief: (circleId: string, sessionId: string) => get<{ brief: string; words: number }>(`/mentor/brief?circleId=${circleId}&sessionId=${sessionId}`),
  dashboard: (circleId?: string) => get<{ sessions: Array<{ sessionId: string; health: { S: number; B: number; U: number; needsHuman: boolean } | null; talkShare: Array<{ learnerId: string; total: number }>; stuck: boolean }>; styleMix: Record<string, number>; aggregatesOnly: boolean }>(`/dashboard${circleId ? `?circleId=${circleId}` : ''}`),
  coachNudge: (targetId: string, input: { explainerId: string; sessionId: string; circleId: string }) => post<{ nudge: string }>(`/coach/nudge/${targetId}`, input),
  coachRephrase: (input: { sessionId: string; circleId: string; text: string; style: string; lang: Lang }) => post<{ suggestion: string }>('/coach/rephrase', input),
  xp: (learnerId: string) => get<{ total: number; badges: string[] }>(`/learners/${learnerId}/xp`),
  xpAward: (learnerId: string, sessionId: string, circleId: string, signal: string) => post<{ xp: number; total: number }>(`/learners/${learnerId}/xp`, { sessionId, circleId, signal }),
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
  state: 'OPEN' | 'NOVA_THINKING' | 'RESOLVED' | 'CLOSED_UNANSWERED';
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
