/** Localized elapsed time for a whole number of minutes. */
export const formatDurationMinutes = (
  totalMinutes: number,
  t: (key: string, values: Record<string, number>) => string,
) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return t('page.bridge.duration', { duration: minutes });
  if (!minutes) return t('page.bridge.duration-hour', { duration: hours });
  return t('page.bridge.duration-hour-min', { hours, minutes });
};
