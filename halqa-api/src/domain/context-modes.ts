import type { ContextMode } from '../common/types/api-error';

export interface AgendaTemplateStep {
  id: string;
  kind: 'goal' | 'explain' | 'challenge' | 'teachback' | 'recap';
  plannedS: number;
}

export interface ContextConfig {
  agenda: AgendaTemplateStep[];
  matcher: boolean;
  mentorBoard: boolean;
  spacedRepetition: boolean;
  bandwidth: 'full' | 'low';
}

/** Context modes (F-V2-9): one enum, no code forks. Agenda/matcher/board/
 *  spaced-rep/bandwidth all derive from this table. */
export const CONTEXT_CONFIGS: Record<ContextMode, ContextConfig> = {
  class: {
    agenda: [
      { id: 'goal', kind: 'goal', plannedS: 120 },
      { id: 'explain', kind: 'explain', plannedS: 600 },
      { id: 'challenge', kind: 'challenge', plannedS: 300 },
      { id: 'teachback', kind: 'teachback', plannedS: 300 },
      { id: 'recap', kind: 'recap', plannedS: 180 },
    ],
    matcher: false,
    mentorBoard: false,
    spacedRepetition: false,
    bandwidth: 'full',
  },
  study: {
    agenda: [
      { id: 'goal', kind: 'goal', plannedS: 60 },
      { id: 'explain', kind: 'explain', plannedS: 420 },
      { id: 'challenge', kind: 'challenge', plannedS: 240 },
      { id: 'teachback', kind: 'teachback', plannedS: 240 },
      { id: 'recap', kind: 'recap', plannedS: 120 },
    ],
    matcher: false,
    mentorBoard: false,
    spacedRepetition: false,
    bandwidth: 'full',
  },
  community: {
    agenda: [
      { id: 'goal', kind: 'goal', plannedS: 60 },
      { id: 'explain', kind: 'explain', plannedS: 420 },
      { id: 'challenge', kind: 'challenge', plannedS: 240 },
      { id: 'recap', kind: 'recap', plannedS: 120 },
    ],
    matcher: false,
    mentorBoard: false,
    spacedRepetition: false,
    bandwidth: 'low',
  },
  workshop: {
    agenda: [
      { id: 'goal', kind: 'goal', plannedS: 120 },
      { id: 'explain', kind: 'explain', plannedS: 480 },
      { id: 'challenge', kind: 'challenge', plannedS: 300 },
      { id: 'recap', kind: 'recap', plannedS: 180 },
    ],
    matcher: true,
    mentorBoard: true,
    spacedRepetition: false,
    bandwidth: 'full',
  },
  program: {
    agenda: [
      { id: 'goal', kind: 'goal', plannedS: 120 },
      { id: 'explain', kind: 'explain', plannedS: 480 },
      { id: 'challenge', kind: 'challenge', plannedS: 300 },
      { id: 'teachback', kind: 'teachback', plannedS: 240 },
      { id: 'recap', kind: 'recap', plannedS: 120 },
    ],
    matcher: false,
    mentorBoard: true,
    spacedRepetition: true,
    bandwidth: 'full',
  },
  solo: {
    agenda: [
      { id: 'goal', kind: 'goal', plannedS: 60 },
      { id: 'challenge', kind: 'challenge', plannedS: 420 },
      { id: 'recap', kind: 'recap', plannedS: 120 },
    ],
    matcher: false,
    mentorBoard: false,
    spacedRepetition: true,
    bandwidth: 'full',
  },
};

export function contextConfig(mode: ContextMode): ContextConfig {
  return CONTEXT_CONFIGS[mode];
}
