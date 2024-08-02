export const TIME_SETTINGS: {
  key: string;
  label: string;
  milliseconds: number;
}[] = [
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
    label: '1 hour',
    milliseconds: 60 * 60 * 1000,
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
];

if (__DEV__) {
  TIME_SETTINGS.push({
    key: '30s',
    label: '30 seconds (DEV ONLY)',
    milliseconds: 30 * 1000,
  });
  TIME_SETTINGS.push({
    key: '10s',
    label: '10 seconds (DEV ONLY)',
    milliseconds: 10 * 1000,
  });
}

export const DEFAULT_AUTO_LOCK_MINUTES = Math.floor(
  TIME_SETTINGS.find(item => item.key === '24h')!.milliseconds / (1000 * 60),
);
