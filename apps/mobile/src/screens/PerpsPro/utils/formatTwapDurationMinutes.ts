/** TWAP confirmation copy uses the same localized units as the duration picker. */
export const formatPerpsProTwapDurationMinutes = (
  totalMinutes: number,
  t: (key: string, values: Record<string, number>) => string,
) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = hours
    ? t(hours === 1 ? 'global.time.hour' : 'global.time.hours', { t: hours })
    : '';
  const minuteText =
    !hours || minutes
      ? t('page.perps.pro.twap.minuteValue', { count: minutes, t: minutes })
      : '';
  return [hourText, minuteText].filter(Boolean).join(' ');
};
