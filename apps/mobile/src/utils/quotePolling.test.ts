import {
  getQuotePollingResumeDelay,
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

  it('resumes polling at the existing deadline instead of immediately', () => {
    expect(
      getQuotePollingResumeDelay({
        deadline: 2000,
        now: 1250,
      }),
    ).toBe(750);

    expect(
      getQuotePollingResumeDelay({
        deadline: 2000,
        now: 2500,
      }),
    ).toBe(0);

    expect(
      getQuotePollingResumeDelay({
        deadline: null,
        now: 2500,
      }),
    ).toBeNull();
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
