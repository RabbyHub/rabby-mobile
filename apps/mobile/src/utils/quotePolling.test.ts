import {
  hasQuotePollingPauseReason,
  shouldScheduleQuotePolling,
  updateQuotePollingPauseReason,
} from './quotePolling';

describe('quotePolling', () => {
  it('schedules polling only when enabled and not paused', () => {
    expect(shouldScheduleQuotePolling({ enabled: true, paused: false })).toBe(
      true,
    );
    expect(shouldScheduleQuotePolling({ enabled: true, paused: true })).toBe(
      false,
    );
    expect(shouldScheduleQuotePolling({ enabled: false, paused: false })).toBe(
      false,
    );
  });

  it('keeps polling paused until all pause reasons are cleared', () => {
    let state = updateQuotePollingPauseReason({
      state: {},
      reason: 'slippage',
      paused: true,
    });

    state = updateQuotePollingPauseReason({
      state,
      reason: 'gas',
      paused: true,
    });

    expect(hasQuotePollingPauseReason(state)).toBe(true);

    state = updateQuotePollingPauseReason({
      state,
      reason: 'slippage',
      paused: false,
    });

    expect(hasQuotePollingPauseReason(state)).toBe(true);

    state = updateQuotePollingPauseReason({
      state,
      reason: 'gas',
      paused: false,
    });

    expect(hasQuotePollingPauseReason(state)).toBe(false);
  });
});
