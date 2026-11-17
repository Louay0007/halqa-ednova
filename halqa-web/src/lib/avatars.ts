// Must match halqa-api/src/domain/ids.ts AVATAR_KEYS — the API silently substitutes unknown keys.
export const AVATARS = ['fox', 'owl', 'star', 'deer', 'wave', 'comet', 'palm', 'lamp'] as const;
export type AvatarKey = (typeof AVATARS)[number];

const GLYPHS: Record<AvatarKey, string> = {
  fox: '🦊',
  owl: '🦉',
  star: '⭐',
  deer: '🦌',
  wave: '🌊',
  comet: '☄️',
  palm: '🌴',
  lamp: '🪔',
};

export function iconFor(key: string | undefined): string {
  return GLYPHS[key as AvatarKey] ?? GLYPHS.star;
}
