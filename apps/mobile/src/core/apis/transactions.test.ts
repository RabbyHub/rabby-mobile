const mockRequestETHRpc = jest.fn();
const mockFetchEstimatedL1Fee = jest.fn();
const mockFindChain = jest.fn();
const mockIntToHex = jest.fn((value: number) => `0x${value.toString(16)}`);
const mockIsTempoChain = jest.fn();
const mockGetTempoFeeTokenInfo = jest.fn();

jest.mock('@/constant/gas', () => ({
  CAN_ESTIMATE_L1_FEE_CHAINS: ['op'],
  DEFAULT_GAS_LIMIT_BUFFER: 0.95,
  DEFAULT_GAS_LIMIT_RATIO: 1.5,
  SAFE_GAS_LIMIT_BUFFER: {
    1: 0.9,
  },
  SAFE_GAS_LIMIT_RATIO: {
    1: 1.2,
  },
}));

jest.mock('@/core/apis/provider', () => ({
  requestETHRpc: (...args: unknown[]) => mockRequestETHRpc(...args),
  fetchEstimatedL1Fee: (...args: unknown[]) => mockFetchEstimatedL1Fee(...args),
}));

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: (...args: unknown[]) => mockRequestETHRpc(...args),
}));

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

jest.mock('@/utils/number', () => ({
  intToHex: (...args: unknown[]) => mockIntToHex(...args),
}));

jest.mock('@/constant/txGasLimit', () => ({
  TX_GAS_LIMIT_CHAIN_MAPPING: {
    LIMITED: 50_000,
    HYPER: 3_000_000,
  },
}));

jest.mock('@/utils/tempo', () => ({
  getTempoFeeTokenInfo: (...args: unknown[]) =>
    mockGetTempoFeeTokenInfo(...args),
  isTempoChain: (...args: unknown[]) => mockIsTempoChain(...args),
}));

import BigNumber from 'bignumber.js';
import {
  calcGasLimit,
  explainGas,
  getGasTokenBalance,
  getNativeTokenBalance,
} from './transactions';

const account = {
  address: '0xabc',
  type: 'SimpleKeyring',
  brandName: 'SimpleKeyring',
};

const mainnetChain = {
  id: 1,
  enum: 'ETH',
  serverId: 'eth',
  nativeTokenAddress: '0xeeee',
  nativeTokenSymbol: 'ETH',
  nativeTokenDecimals: 18,
  nativeTokenLogo: 'eth.png',
};

describe('core/apis/transactions gas utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestETHRpc.mockResolvedValue('0x10');
    mockFetchEstimatedL1Fee.mockResolvedValue('0');
    mockFindChain.mockReturnValue(mainnetChain);
    mockIsTempoChain.mockReturnValue(false);
    mockGetTempoFeeTokenInfo.mockResolvedValue({
      rawBalanceHex: '0x20',
      tokenId: '0xfee',
      symbol: 'FEE',
      decimals: 18,
      logoUrl: 'fee.png',
    });
  });

  it('calculates gas limit with chain-specific ratio and clamps to block gas limit buffer', async () => {
    await expect(
      calcGasLimit({
        chain: mainnetChain as never,
        tx: {
          gas: '0x5208',
          value: '0',
        } as never,
        gas: new BigNumber(100_000),
        selectedGas: {
          price: 1,
        } as never,
        nativeTokenBalance: '100000000000000000000',
        explainTx: {
          gas: {
            gas_ratio: 2,
          },
        } as never,
        needRatio: true,
        account: account as never,
        preparedBlock: {
          gasLimit: '110000',
        } as never,
      }),
    ).resolves.toEqual({
      gasLimit: '0x182b8',
      recommendGasLimitRatio: 1.2,
    });

    expect(mockIntToHex).toHaveBeenCalledWith(99_000);
    expect(mockRequestETHRpc).not.toHaveBeenCalled();
  });

  it('uses explain gas ratio when estimated cost would exceed available balance', async () => {
    await expect(
      calcGasLimit({
        chain: mainnetChain as never,
        tx: {
          gas: '0x0',
          value: '0',
        } as never,
        gas: new BigNumber(100),
        selectedGas: {
          price: 10,
        } as never,
        nativeTokenBalance: '1',
        explainTx: {
          gas: {
            gas_ratio: 3,
          },
        } as never,
        needRatio: true,
        account: account as never,
        preparedBlock: null,
      }),
    ).resolves.toEqual({
      gasLimit: '0x12c',
      recommendGasLimitRatio: 3,
    });

    expect(mockRequestETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      },
      'eth',
      account,
    );
  });

  it('uses mapped single transaction gas limit as an upper bound', async () => {
    const limitedChain = {
      ...mainnetChain,
      enum: 'LIMITED',
      id: 998,
    };

    await expect(
      calcGasLimit({
        chain: limitedChain as never,
        tx: {
          gas: '0x0',
          value: '0',
        } as never,
        gas: new BigNumber(100_000),
        selectedGas: null,
        nativeTokenBalance: '100000000000',
        explainTx: {
          gas: {
            gas_ratio: 2,
          },
        } as never,
        needRatio: false,
        account: account as never,
      }),
    ).resolves.toEqual({
      gasLimit: '0xc350',
      recommendGasLimitRatio: 1,
    });
  });

  it.each([
    ['exceeds the mapped single tx gas limit', 'LIMITED', '0xc351', '0x5208'],
    ['equals the mapped single tx gas limit', 'LIMITED', '0xc350', '0xc350'],
    ['exceeds the block gas limit', 'ETH', '0xf4241', '0x5208'],
    ['equals the block gas limit', 'ETH', '0xf4240', '0xf4240'],
    ['is not a number', 'ETH', '0x', '0x5208'],
  ])(
    'uses dapp tx.gas only within chain limits: tx.gas %s',
    async (_, chainEnum, txGas, expectedGasLimit) => {
      await expect(
        calcGasLimit({
          chain: { ...mainnetChain, enum: chainEnum } as never,
          tx: { gas: txGas, value: '0' } as never,
          gas: new BigNumber(21_000),
          selectedGas: null,
          nativeTokenBalance: '100000000000',
          explainTx: { gas: { gas_ratio: 2 } } as never,
          needRatio: false,
          account: account as never,
          preparedBlock: { gasLimit: '1000000' } as never,
        }),
      ).resolves.toEqual({
        gasLimit: expectedGasLimit,
        recommendGasLimitRatio: 1,
      });
    },
  );

  it.each(['rejects', 'resolves to null'])(
    'fetches the latest block when the prepared block %s',
    async preparedResult => {
      mockRequestETHRpc.mockResolvedValue({ gasLimit: '50000' });
      const preparedBlock =
        preparedResult === 'rejects'
          ? Promise.reject(new Error('block unavailable'))
          : Promise.resolve(null);

      await expect(
        calcGasLimit({
          chain: mainnetChain as never,
          tx: { value: '0' } as never,
          gas: new BigNumber(100_000),
          selectedGas: null,
          nativeTokenBalance: '100000000000',
          explainTx: { gas: { gas_ratio: 2 } } as never,
          needRatio: false,
          account: account as never,
          preparedBlock,
        }),
      ).resolves.toEqual({
        gasLimit: `0x${(45_000).toString(16)}`,
        recommendGasLimitRatio: 1,
      });
      expect(mockRequestETHRpc).toHaveBeenCalledWith(
        {
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        },
        'eth',
        account,
      );
    },
  );

  describe('HyperEVM sender gas limit', () => {
    const hyperChain = {
      ...mainnetChain,
      id: 999,
      enum: 'HYPER',
      serverId: 'hyper',
    };
    const txFrom = '0xdef';
    const calculateGas = (
      overrides: Partial<Parameters<typeof calcGasLimit>[0]> = {},
    ) =>
      calcGasLimit({
        chain: hyperChain as never,
        tx: { from: txFrom, value: '0' } as never,
        gas: new BigNumber(8_300_000),
        selectedGas: null,
        nativeTokenBalance: '100000000000000000000',
        explainTx: { gas: { gas_ratio: 2 } } as never,
        needRatio: true,
        account: account as never,
        preparedBlock: { gasLimit: '3000000' } as never,
        ...overrides,
      });

    it('uses the transaction sender mode instead of the latest block size', async () => {
      mockRequestETHRpc.mockResolvedValue(true);

      await expect(calculateGas()).resolves.toEqual({
        gasLimit: `0x${(12_450_000).toString(16)}`,
        recommendGasLimitRatio: 1.5,
      });
      expect(mockRequestETHRpc).toHaveBeenCalledTimes(1);
      expect(mockRequestETHRpc).toHaveBeenCalledWith(
        {
          method: 'eth_usingBigBlocks',
          params: [txFrom],
        },
        'hyper',
        account,
      );
    });

    it.each<[string, unknown, number, number]>([
      ['big blocks', true, 25_000_000, 30_000_000],
      ['small blocks', false, 8_300_000, 3_000_000],
      ['a string response', 'true', 8_300_000, 3_000_000],
      ['a numeric response', 1, 8_300_000, 3_000_000],
      ['a missing response', null, 8_300_000, 3_000_000],
    ])(
      'caps the estimate for %s',
      async (_, rpcResult, estimatedGas, expectedGas) => {
        mockRequestETHRpc.mockResolvedValue(rpcResult);

        await expect(
          calculateGas({ gas: new BigNumber(estimatedGas) }),
        ).resolves.toEqual({
          gasLimit: `0x${expectedGas.toString(16)}`,
          recommendGasLimitRatio: 1.5,
        });
      },
    );

    it('falls back to the small sender limit when the RPC fails', async () => {
      mockRequestETHRpc.mockRejectedValue(new Error('unsupported method'));

      await expect(calculateGas()).resolves.toEqual({
        gasLimit: `0x${(3_000_000).toString(16)}`,
        recommendGasLimitRatio: 1.5,
      });
      expect(mockRequestETHRpc).toHaveBeenCalledTimes(1);
    });

    it('falls back after a five-second timeout', async () => {
      jest.useFakeTimers();
      try {
        mockRequestETHRpc.mockReturnValue(new Promise(() => {}));
        const result = calculateGas();

        await jest.advanceTimersByTimeAsync(5_000);

        await expect(result).resolves.toEqual({
          gasLimit: `0x${(3_000_000).toString(16)}`,
          recommendGasLimitRatio: 1.5,
        });
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it.each<[boolean, number, number]>([
      [true, 30_000_000, 30_000_000],
      [true, 30_000_001, 21_000],
      [false, 3_000_000, 3_000_000],
      [false, 3_000_001, 21_000],
    ])(
      'honors dapp gas only within the sender limit: mode=%s gas=%s',
      async (usingBigBlocks, dappGas, expectedGas) => {
        mockRequestETHRpc.mockResolvedValue(usingBigBlocks);

        await expect(
          calculateGas({
            tx: {
              from: txFrom,
              value: '0',
              gas: `0x${dappGas.toString(16)}`,
            } as never,
            gas: new BigNumber(21_000),
            needRatio: false,
          }),
        ).resolves.toEqual({
          gasLimit: `0x${expectedGas.toString(16)}`,
          recommendGasLimitRatio: 1,
        });
      },
    );

    it('preserves the block-based calculation for Gnosis accounts', async () => {
      await expect(
        calculateGas({ account: { ...account, type: 'Gnosis' } as never }),
      ).resolves.toEqual({
        gasLimit: `0x${(2_850_000).toString(16)}`,
        recommendGasLimitRatio: 1.5,
      });
      expect(mockRequestETHRpc).not.toHaveBeenCalled();
    });
  });

  it('loads native token gas balance through read-only RPC', async () => {
    mockRequestETHRpc.mockResolvedValue('0x10');

    await expect(
      getGasTokenBalance({
        address: '0xabc',
        chainId: 1,
        account: account as never,
      }),
    ).resolves.toEqual({
      rawBalance: '16',
      token: {
        tokenId: '0xeeee',
        symbol: 'ETH',
        decimals: 18,
        logoUrl: 'eth.png',
      },
    });

    expect(mockRequestETHRpc).toHaveBeenCalledWith(
      {
        method: 'eth_getBalance',
        params: ['0xabc', 'latest'],
      },
      'eth',
      account,
    );
    await expect(
      getNativeTokenBalance({
        address: '0xabc',
        chainId: 1,
        account: account as never,
      }),
    ).resolves.toBe('16');
  });

  it('loads Tempo fee-token gas balance when the chain uses Tempo gas tokens', async () => {
    mockFindChain.mockReturnValue({
      ...mainnetChain,
      serverId: 'tempo',
    });
    mockIsTempoChain.mockReturnValue(true);

    await expect(
      getGasTokenBalance({
        address: '0xabc',
        chainId: 1,
        account: account as never,
      }),
    ).resolves.toEqual({
      rawBalance: '32',
      token: {
        tokenId: '0xfee',
        symbol: 'FEE',
        decimals: 18,
        logoUrl: 'fee.png',
      },
    });

    expect(mockGetTempoFeeTokenInfo).toHaveBeenCalledWith({
      account,
      userAddress: '0xabc',
      chainServerId: 'tempo',
    });
    expect(mockRequestETHRpc).not.toHaveBeenCalled();
  });

  it('explains gas with prepared L1 fee and token decimal conversion', async () => {
    mockFindChain.mockReturnValue({
      ...mainnetChain,
      enum: 'op',
      serverId: 'op',
    });

    const result = await explainGas({
      gasUsed: 21_000,
      gasPrice: 1_000_000_000,
      chainId: 1,
      nativeTokenPrice: 2,
      tx: {
        from: '0xabc',
      } as never,
      gasLimit: '30000',
      account: account as never,
      preparedL1Fee: '1000000000000000000',
      gasTokenDecimals: 6,
    });

    expect(result.gasCostUsd.toFixed()).toBe('2.000042');
    expect(result.gasCostAmount.toFixed()).toBe('1.000021');
    expect(result.maxGasCostAmount.toFixed()).toBe('1.00003');
    expect(result.gasCostRawAmount.toFixed()).toBe('1000021');
    expect(result.maxGasCostRawAmount.toFixed()).toBe('1000030');
    expect(mockFetchEstimatedL1Fee).not.toHaveBeenCalled();
  });

  it('fetches L1 fee when needed and prices Tempo gas at unit price', async () => {
    mockFindChain.mockReturnValue({
      ...mainnetChain,
      enum: 'op',
      serverId: 'tempo',
    });
    mockIsTempoChain.mockReturnValue(true);
    mockFetchEstimatedL1Fee.mockResolvedValue('1000000000000000000');

    const result = await explainGas({
      gasUsed: 1,
      gasPrice: 1_000_000_000,
      chainId: 1,
      nativeTokenPrice: 999,
      tx: {
        from: '0xabc',
      } as never,
      gasLimit: '2',
      account: account as never,
    });

    expect(result.gasCostUsd.toFixed()).toBe('1.000000001');
    expect(mockFetchEstimatedL1Fee).toHaveBeenCalledWith(
      {
        txParams: {
          from: '0xabc',
        },
        account,
      },
      'op',
    );
  });

  it('throws when gas balance or gas explanation chain is not supported', async () => {
    mockFindChain.mockReturnValue(undefined);

    await expect(
      getGasTokenBalance({
        address: '0xabc',
        chainId: 999,
        account: account as never,
      }),
    ).rejects.toThrow('chain not found');

    await expect(
      explainGas({
        gasUsed: 1,
        gasPrice: 1,
        chainId: 999,
        nativeTokenPrice: 1,
        tx: {} as never,
        gasLimit: '1',
        account: account as never,
      }),
    ).rejects.toThrow('999 is not found in supported chains');
  });
});
