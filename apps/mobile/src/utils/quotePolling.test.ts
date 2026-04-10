import { shouldScheduleQuotePolling } from './quotePolling';

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
});
