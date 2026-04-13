export const shouldScheduleQuotePolling = ({
  enabled,
  paused,
}: {
  enabled: boolean;
  paused: boolean;
}) => enabled && !paused;
