export const GAS_LEVEL_TEXT = {
  $unknown: 'Unknown',
  slow: 'Standard',
  normal: 'Fast',
  fast: 'Instant',
  custom: 'Custom',
} as const;

export function getGasLevelI18nKey(level: string) {
  if (!GAS_LEVEL_TEXT[level])
    return 'page.sendToken.GasSelector.level.$unknown' as const;

  return `page.sendToken.GasSelector.level.${
    level as keyof typeof GAS_LEVEL_TEXT
  }` as const;
}
