// Ported formatEstimateClock from Rabby Bridge utils/duration.ts.
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

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
