export const shouldScheduleQuotePolling = ({
  enabled,
  paused,
}: {
  enabled: boolean;
  paused: boolean;
}) => enabled && !paused;

export const getQuotePollingResumeDelay = ({
  deadline,
  now = Date.now(),
}: {
  deadline?: number | null;
  now?: number;
}) => {
  if (!deadline) {
    return null;
  }

  return Math.max(deadline - now, 0);
};

export type QuotePollingPauseReasonState = Record<string, true>;

export const updateQuotePollingPauseReason = ({
  state,
  reason,
  paused,
}: {
  state: QuotePollingPauseReasonState;
  reason: string;
  paused: boolean;
}): QuotePollingPauseReasonState => {
  const next = { ...state };

  if (paused) {
    next[reason] = true;
  } else {
    delete next[reason];
  }

  return next;
};

export const hasQuotePollingPauseReason = (
  state: QuotePollingPauseReasonState,
) => Object.keys(state).length > 0;
