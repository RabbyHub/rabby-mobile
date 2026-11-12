import { waitForTxCompleted } from './waitForTxCompleted';

const mockGetRpcTxReceipt = jest.fn();
jest.mock('@/core/utils/tx', () => ({
  getRpcTxReceipt: (...args: unknown[]) => mockGetRpcTxReceipt(...args),
}));
jest.mock('@/utils/events', () => {
  const { EventEmitter } = require('events');
  return {
    eventBus: new EventEmitter(),
    EVENTS: { TX_COMPLETED: 'TX_COMPLETED' },
  };
});

describe('waitForTxCompleted', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetRpcTxReceipt.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('resolves when the receipt succeeds', async () => {
    mockGetRpcTxReceipt.mockResolvedValue({ code: 0, status: 1 });
    await expect(
      waitForTxCompleted({ hash: '0x1', chainServerId: 'eth' }),
    ).resolves.toBe(true);
  });

  it('rejects when the receipt reverted', async () => {
    mockGetRpcTxReceipt.mockResolvedValue({ code: 0, status: 0 });
    await expect(
      waitForTxCompleted({ hash: '0x1', chainServerId: 'eth' }),
    ).rejects.toThrow('tx failed');
  });

  it('keeps polling without a timeout until mined', async () => {
    mockGetRpcTxReceipt.mockResolvedValue({ code: -1, status: 0 });
    const result = waitForTxCompleted({ hash: '0x1', chainServerId: 'eth' });
    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    mockGetRpcTxReceipt.mockResolvedValue({ code: 0, status: 1 });
    await jest.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBe(true);
  });

  it('rejects on timeout when timeoutMs is given', async () => {
    mockGetRpcTxReceipt.mockResolvedValue({ code: -1, status: 0 });
    const result = waitForTxCompleted({
      hash: '0x1',
      chainServerId: 'eth',
      timeoutMs: 60 * 1000,
    });
    const assertion = expect(result).rejects.toThrow('tx receipt timeout');
    await jest.advanceTimersByTimeAsync(60 * 1000);
    await assertion;
  });

  it('rejects with the provided cancel error once cancelled', async () => {
    mockGetRpcTxReceipt.mockResolvedValue({ code: -1, status: 0 });
    let cancelled = false;
    const cancelError = new Error('cancelled!');
    const result = waitForTxCompleted({
      hash: '0x1',
      chainServerId: 'eth',
      isTaskCancelled: () => cancelled,
      createCancelledError: () => cancelError,
    });
    const assertion = expect(result).rejects.toBe(cancelError);
    cancelled = true;
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});
