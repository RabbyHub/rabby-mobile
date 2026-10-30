// Ported time formatters from Rabby Bridge utils/duration.ts.
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const DURATION_ORANGE_MINUTES = 3;
const DURATION_RED_MINUTES = 10;

type DurationCopy = {
  duration?: number;
  days?: number;
  hours?: number;
  minutes?: number;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Clock for a live estimate. Under 1h stays m:ss; longer quotes show hours, then days. */
export const formatEstimateClock = (
  remainingSeconds: number,
  padMinutes = false,
) => {
  const total = Math.max(0, Math.ceil(remainingSeconds));
  const days = Math.floor(total / SECONDS_PER_DAY);
  const hours = Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = total % SECONDS_PER_MINUTE;
  const clock = `${pad2(minutes)}:${pad2(seconds)}`;

  if (days > 0) {
    return `${days}d ${hours}:${clock}`;
  }
  if (hours > 0) {
    return `${hours}:${clock}`;
  }
  return `${padMinutes ? pad2(minutes) : String(minutes)}:${pad2(seconds)}`;
};

const getBridgeDurationMinutes = (durationSeconds = 0) =>
  Math.max(Math.round(durationSeconds / SECONDS_PER_MINUTE), 1);

export const formatBridgeDuration = (
  durationSeconds: number | undefined,
  t: (key: string, options: DurationCopy) => string,
) => {
  const seconds = durationSeconds || 0;
  if (seconds < SECONDS_PER_MINUTE) {
    return t('page.bridge.duration-sec', {
      duration: Math.max(Math.round(seconds), 1),
    });
  }

  const totalMinutes = getBridgeDurationMinutes(seconds);
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (days > 0) {
    if (hours > 0 && minutes > 0) {
      return t('page.bridge.duration-day-hour-min', { days, hours, minutes });
    }
    if (hours > 0) {
      return t('page.bridge.duration-day-hour', { days, hours });
    }
    if (minutes > 0) {
      return t('page.bridge.duration-day-min', { days, minutes });
    }
    return t('page.bridge.duration-day', { duration: days });
  }

  if (hours > 0) {
    if (minutes > 0) {
      return t('page.bridge.duration-hour-min', { hours, minutes });
    }
    return t('page.bridge.duration-hour', { duration: hours });
  }

  return t('page.bridge.duration', { duration: totalMinutes });
};

// 与 formatBridgeDuration 同一取整，颜色档位才与展示的分钟数一致。
export const getBridgeDurationColor = (
  durationSeconds: number | undefined,
  colors: Record<'red-default' | 'orange-default' | 'brand-default', string>,
) => {
  const minutes = getBridgeDurationMinutes(durationSeconds || 0);
  if (minutes > DURATION_RED_MINUTES) {
    return colors['red-default'];
  }
  if (minutes > DURATION_ORANGE_MINUTES) {
    return colors['orange-default'];
  }
  return colors['brand-default'];
};
