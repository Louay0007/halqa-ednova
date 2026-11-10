export type Language = 'ar' | 'darija' | 'fr' | 'en';
export type ContextMode = 'class' | 'study' | 'community' | 'workshop' | 'program' | 'solo';

export interface ApiErrorBody {
  error: string;
  code: string;
  retryable: boolean;
  user_msg: Record<Language, string>;
}

export function apiError(
  error: string,
  code: string,
  retryable: boolean,
  userMsg: Partial<Record<Language, string>> & { en: string },
): ApiErrorBody {
  return {
    error,
    code,
    retryable,
    user_msg: {
      ar: userMsg.ar ?? userMsg.en,
      darija: userMsg.darija ?? userMsg.en,
      fr: userMsg.fr ?? userMsg.en,
      en: userMsg.en,
    },
  };
}
