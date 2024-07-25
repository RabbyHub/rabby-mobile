export const TIME_SETTINGS = [
  {
    key: '24h',
    label: '24 hours',
    milliseconds: 24 * 60 * 60 * 1000,
  },
  {
    key: '12h',
    label: '12 hours',
    milliseconds: 12 * 60 * 60 * 1000,
  },
  {
    key: '4h',
    label: '4 hours',
    milliseconds: 4 * 60 * 60 * 1000,
  },
  {
    key: '1h',
    label: '30 minutes',
    milliseconds: 30 * 60 * 1000,
  },
  {
    key: '10m',
    label: '10 minutes',
    milliseconds: 10 * 60 * 1000,
  },
  {
    key: '5m',
    label: '5 minutes',
    milliseconds: 5 * 60 * 1000,
  },
] as const;

export const DEFAULT_AUTO_LOCK_MINUTES = Math.floor(
  TIME_SETTINGS.find(item => item.key === '5m')!.milliseconds / (1000 * 60),
);
