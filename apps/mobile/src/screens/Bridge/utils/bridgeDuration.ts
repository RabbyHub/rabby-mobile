const BRIDGE_DURATION_SECONDS_THRESHOLD = 60;

export const getBridgeDurationMinutes = (duration: number) =>
  Math.ceil(duration / BRIDGE_DURATION_SECONDS_THRESHOLD);

type BridgeDurationColors = {
  'red-default': string;
  'orange-default': string;
  'brand-default': string;
};

export const getBridgeDurationColor = (
  duration: number,
  colors: BridgeDurationColors,
) => {
  const mins = getBridgeDurationMinutes(duration);
  if (mins > 10) {
    return colors['red-default'];
  }
  if (mins > 3) {
    return colors['orange-default'];
  }
  return colors['brand-default'];
};

export const formatBridgeDurationLabel = (
  duration: number,
  t: (key: string, options?: { duration: number }) => string,
) => {
  if (duration < BRIDGE_DURATION_SECONDS_THRESHOLD) {
    return t('page.bridge.durationSeconds', {
      duration: Math.ceil(duration),
    });
  }

  return t('page.bridge.duration', {
    duration: getBridgeDurationMinutes(duration),
  });
};
