export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function isPlaybackRate(value: unknown): value is number {
  return typeof value === 'number' && PLAYBACK_RATES.some(rate => rate === value);
}

export function normalizePlaybackRate(value: unknown): number {
  return isPlaybackRate(value) ? value : 1;
}
