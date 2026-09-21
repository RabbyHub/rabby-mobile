import { startPerpsFundingLedgerPolling } from './fundingHistoryPolling';

describe('funding history polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queries immediately, backs off, and stops without leaking a timer', async () => {
    const fetchLedger = jest.fn(async () => undefined);
    const stop = startPerpsFundingLedgerPolling({
      fetchLedger,
      pollDelaysMs: [2_000, 4_000],
      shouldContinue: () => true,
    });

    await Promise.resolve();
    expect(fetchLedger).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);
    expect(fetchLedger).toHaveBeenCalledTimes(2);

    stop();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchLedger).toHaveBeenCalledTimes(2);
  });

  it('does not schedule another query after pending or account scope ends', async () => {
    let shouldContinue = true;
    const fetchLedger = jest.fn(async () => undefined);
    startPerpsFundingLedgerPolling({
      fetchLedger,
      pollDelaysMs: [2_000],
      shouldContinue: () => shouldContinue,
    });

    shouldContinue = false;
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10_000);

    expect(fetchLedger).toHaveBeenCalledTimes(1);
  });

  it('does not schedule after cleanup while a request is still in flight', async () => {
    let resolveRequest: (() => void) | undefined;
    const fetchLedger = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveRequest = resolve;
        }),
    );
    const stop = startPerpsFundingLedgerPolling({
      fetchLedger,
      pollDelaysMs: [2_000],
      shouldContinue: () => true,
    });

    stop();
    resolveRequest?.();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10_000);

    expect(fetchLedger).toHaveBeenCalledTimes(1);
  });
});
