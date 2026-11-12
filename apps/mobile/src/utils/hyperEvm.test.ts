const mockRequestETHRpc = jest.fn();

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: (...args: unknown[]) => mockRequestETHRpc(...args),
}));

import { getHyperEvmGasLimit } from './hyperEvm';

const account = {
  address: '0xabc',
  type: 'SimpleKeyring',
  brandName: 'SimpleKeyring',
};
const params = {
  chain: { id: 999, serverId: 'hyper' },
  from: '0xdef',
  account: account as never,
};

describe('HyperEVM sender gas limit', () => {
  beforeEach(() => {
    mockRequestETHRpc.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    [true, 30_000_000],
    [false, 3_000_000],
    ['true', null],
    [1, null],
    [null, null],
  ])('maps mode %p to %p', async (mode, gasLimit) => {
    mockRequestETHRpc.mockResolvedValue(mode);

    await expect(getHyperEvmGasLimit(params)).resolves.toBe(gasLimit);
    expect(mockRequestETHRpc).toHaveBeenCalledWith(
      { method: 'eth_usingBigBlocks', params: [params.from] },
      params.chain.serverId,
      account,
    );
  });

  it('does not query another chain', async () => {
    await expect(
      getHyperEvmGasLimit({ ...params, chain: { id: 1, serverId: 'eth' } }),
    ).resolves.toBeNull();
    expect(mockRequestETHRpc).not.toHaveBeenCalled();
  });

  it('returns unknown when the RPC fails', async () => {
    mockRequestETHRpc.mockRejectedValue(new Error('unsupported method'));
    await expect(getHyperEvmGasLimit(params)).resolves.toBeNull();
  });

  it('returns unknown after five seconds and clears the timeout', async () => {
    jest.useFakeTimers();
    mockRequestETHRpc.mockReturnValue(new Promise(() => {}));
    const result = getHyperEvmGasLimit(params);
    await jest.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});
