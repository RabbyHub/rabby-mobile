const mockGetRecommendNonce = jest.fn();

jest.mock('@/core/apis/recommendNonce', () => ({
  getRecommendNonce: (...args: unknown[]) => mockGetRecommendNonce(...args),
}));

jest.mock('i18next', () => ({
  t: jest.fn((key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  ),
}));

jest.mock('./number', () => ({
  intToHex: (value: number) => `0x${value.toString(16)}`,
}));

import {
  getRetryTxRecommendNonce,
  getRetryTxType,
  getTxFailedResult,
  retryTxReset,
  setRetryTxRecommendNonce,
  setRetryTxType,
} from './errorTxRetry';

describe('errorTxRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retryTxReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores and resets retry type state', () => {
    expect(getRetryTxType()).toBe(false);

    setRetryTxType('gasPrice');
    expect(getRetryTxType()).toBe('gasPrice');

    retryTxReset();
    expect(getRetryTxType()).toBe(false);
    expect(getRetryTxRecommendNonce()).toBe('0x0');
  });

  it('keeps the provider recommended nonce when it differs from the current one', async () => {
    mockGetRecommendNonce.mockResolvedValue('0x3');

    await expect(
      setRetryTxRecommendNonce({
        nonce: '0x1',
        from: '0xabc',
        chainId: 1,
        account: {} as never,
      }),
    ).resolves.toBe('0x3');

    expect(getRetryTxRecommendNonce()).toBe('0x3');
  });

  it('increments the current nonce when the provider recommendation is unchanged', async () => {
    mockGetRecommendNonce.mockResolvedValue('0x1');

    await expect(
      setRetryTxRecommendNonce({
        nonce: '0x1',
        from: '0xabc',
        chainId: 1,
        account: {} as never,
      }),
    ).resolves.toBe('0x2');

    expect(getRetryTxRecommendNonce()).toBe('0x2');
  });

  it('falls back to incrementing the nonce when the provider request fails', async () => {
    const consoleDebugSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => undefined);
    mockGetRecommendNonce.mockRejectedValue(new Error('boom'));

    await expect(
      setRetryTxRecommendNonce({
        nonce: '0x2',
        from: '0xabc',
        chainId: 1,
        account: {} as never,
      }),
    ).resolves.toBe('0x3');

    expect(getRetryTxRecommendNonce()).toBe('0x3');
    expect(consoleDebugSpy).toHaveBeenCalled();
  });

  it('returns the translated retry hint for known keywords and uses the current recommended nonce', async () => {
    setRetryTxType('nonce');
    mockGetRecommendNonce.mockResolvedValue('0x2');

    await setRetryTxRecommendNonce({
      nonce: '0x1',
      from: '0xabc',
      chainId: 1,
      account: {} as any,
    });

    const result = getTxFailedResult('Nonce too low: try again later');

    expect(result).toEqual([
      'page.signTx.errorRetry.nonceTooLow:{"nonce":2}',
      'nonce',
    ]);
  });

  it('falls back to the original error text when no hint rule matches', () => {
    expect(getTxFailedResult('something custom happened')).toEqual([
      'something custom happened',
      false,
    ]);
  });
});
