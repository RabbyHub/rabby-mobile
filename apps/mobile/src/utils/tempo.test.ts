import BigNumber from 'bignumber.js';
import { encodeFunctionResult } from 'viem';

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: jest.fn(),
}));

jest.mock('@/core/request', () => ({
  openapi: {
    getToken: jest.fn(),
    listToken: jest.fn(),
  },
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_TYPE: {
    SimpleKeyring: 'SimpleKeyring',
    HdKeyring: 'HdKeyring',
    WatchAddressKeyring: 'WatchAddressKeyring',
  },
}));

import { TEMPO_CHAIN_SERVER_ID, TEMPO_PATH_USD_TOKEN } from '@/constant/tempo';
import { requestReadOnlyETHRpc } from '@/core/apis/readOnlyRpc';
import { openapi } from '@/core/request';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  buildTempoBatchTransaction,
  buildTempoTransaction,
  calcTempoMaxGasCostRawAmountIn18,
  convert18RawToTokenRaw,
  findTempoFeeTokenOption,
  getTempoFeeTokenAddress,
  getTempoFeeTokenInfo,
  getTxMatchData,
  hasValidTempoCalls,
  hasValidTempoFeePayerSignature,
  isTempoBatchSupportedAccountType,
  isTempoChain,
  isTempoSpecialTransaction,
  isTempoTxType,
  listTempoFeeTokenOptions,
  listTempoFeeTokenOptionsFromCache,
  loadTempoFeeTokenOptionsState,
  resolveTempoDefaultTokenId,
  resolveTempoPreferredFeeTokenId,
  shouldUseTempoBatchTransaction,
  shouldUseTempoTransaction,
  toTempoCallsTx,
} from './tempo';
import { normalizeTempoChainServerId } from './tempoChain';

const mockRequestReadOnlyETHRpc = requestReadOnlyETHRpc as jest.MockedFunction<
  typeof requestReadOnlyETHRpc
>;
const mockOpenapi = openapi as jest.Mocked<typeof openapi>;

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: KEYRING_TYPE.SimpleKeyring,
} as any;

const userAddress = '0x2222222222222222222222222222222222222222';
const usdcTokenId = '0x20C000000000000000000000b9537d11c60E8b50';
const usdtTokenId = '0x20C00000000000000000000014f22CA97301EB73';

const tokenItem = (overrides: Partial<TokenItem>): TokenItem =>
  ({
    amount: 0,
    chain: TEMPO_CHAIN_SERVER_ID,
    decimals: 6,
    display_symbol: overrides.symbol || '',
    id: '',
    is_core: false,
    is_verified: true,
    is_wallet: true,
    logo_url: '',
    name: overrides.symbol || '',
    optimized_symbol: overrides.symbol || '',
    price: 0,
    raw_amount: '0',
    raw_amount_hex_str: '0x0',
    symbol: '',
    time_at: 0,
    usd_value: 0,
    ...overrides,
  } as TokenItem);

const encodedAddressResult = (address: string) =>
  encodeFunctionResult({
    abi: [
      {
        name: 'getUserToken',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'address' }],
      },
    ],
    functionName: 'getUserToken',
    result: address as `0x${string}`,
  });

describe('tempo chain helpers', () => {
  it('normalizes Tempo chain ids case-insensitively', () => {
    expect(normalizeTempoChainServerId('TeMpO')).toBe('tempo');
    expect(isTempoChain('TEMPO')).toBe(true);
    expect(isTempoChain('eth')).toBe(false);
  });

  it('converts 18-decimal raw gas requirements into token decimals', () => {
    const oneTokenIn18 = new BigNumber('1000000000000000000');

    expect(convert18RawToTokenRaw(oneTokenIn18, 6).toFixed(0)).toBe('1000000');
    expect(convert18RawToTokenRaw(oneTokenIn18, 18).toFixed(0)).toBe(
      '1000000000000000000',
    );
    expect(convert18RawToTokenRaw(oneTokenIn18, 20).toFixed(0)).toBe(
      '100000000000000000000',
    );
  });

  it('sums max gas cost from legacy and EIP-1559 fields', () => {
    const maxCost = calcTempoMaxGasCostRawAmountIn18([
      { gas: 21_000, gasPrice: '0x3b9aca00' },
      { gasLimit: '50000', maxFeePerGas: '2000000000' },
      { gas: 0, gasPrice: '1000000000' },
      { gas: 'bad-number', gasPrice: '1000000000' },
    ]);

    expect(maxCost.toFixed(0)).toBe('121000000000000');
  });
});

describe('tempo transaction predicates', () => {
  it('recognizes Tempo transaction types and fee payer signatures', () => {
    expect(isTempoTxType(118)).toBe(true);
    expect(isTempoTxType('0X76')).toBe(true);
    expect(isTempoTxType('tempo')).toBe(true);
    expect(isTempoTxType('0x0')).toBe(false);

    expect(hasValidTempoFeePayerSignature('0x1234')).toBe(true);
    expect(
      hasValidTempoFeePayerSignature({ r: '0x1', s: '0x2', yParity: 1 }),
    ).toBe(true);
    expect(hasValidTempoFeePayerSignature({ r: '0x1', s: '', v: 27 })).toBe(
      false,
    );
  });

  it('validates Tempo calls without requiring every optional field', () => {
    expect(
      hasValidTempoCalls([{ to: userAddress, data: '0xabcdef', value: 1n }]),
    ).toBe(true);
    expect(hasValidTempoCalls([{ to: userAddress }])).toBe(true);
    expect(hasValidTempoCalls([{ data: 123 }])).toBe(false);
    expect(hasValidTempoCalls([])).toBe(false);
  });

  it('detects special Tempo transactions from any Tempo-only field', () => {
    expect(isTempoSpecialTransaction({ type: '0x76' })).toBe(true);
    expect(isTempoSpecialTransaction({ feeToken: usdcTokenId })).toBe(true);
    expect(isTempoSpecialTransaction({ nonceKey: '0x1' })).toBe(true);
    expect(isTempoSpecialTransaction({ data: '0xabcdef' })).toBe(false);
  });

  it('gates Tempo signing by chain, account type, gas-account mode, and tx shape', () => {
    expect(isTempoBatchSupportedAccountType(KEYRING_TYPE.SimpleKeyring)).toBe(
      true,
    );
    expect(
      isTempoBatchSupportedAccountType(KEYRING_TYPE.WatchAddressKeyring),
    ).toBe(false);

    expect(
      shouldUseTempoTransaction({
        tx: { data: '0x' },
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        accountType: KEYRING_TYPE.SimpleKeyring,
        isGasAccount: true,
      }),
    ).toBe(true);
    expect(
      shouldUseTempoTransaction({
        tx: { feeToken: usdcTokenId },
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        accountType: KEYRING_TYPE.HdKeyring,
      }),
    ).toBe(true);
    expect(
      shouldUseTempoTransaction({
        tx: { feeToken: usdcTokenId },
        chainServerId: 'eth',
        accountType: KEYRING_TYPE.SimpleKeyring,
      }),
    ).toBe(false);
    expect(
      shouldUseTempoTransaction({
        tx: { feeToken: usdcTokenId },
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        accountType: KEYRING_TYPE.WatchAddressKeyring,
      }),
    ).toBe(false);
  });

  it('uses Tempo batch only for supported accounts with more than one tx', () => {
    expect(
      shouldUseTempoBatchTransaction({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        accountType: KEYRING_TYPE.SimpleKeyring,
        txs: [{}, {}],
      }),
    ).toBe(true);
    expect(
      shouldUseTempoBatchTransaction({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        accountType: KEYRING_TYPE.SimpleKeyring,
        txCount: 1,
      }),
    ).toBe(false);
  });
});

describe('tempo transaction builders', () => {
  it('chooses tx match data from top-level data before call data', () => {
    expect(
      getTxMatchData({ data: '0xaaaa', calls: [{ data: '0xbbbb' }] }),
    ).toBe('0xaaaa');
    expect(
      getTxMatchData({ calls: [{ data: '0xaaaa' }, { data: '0xbbbb' }] }),
    ).toBe('0xbbbb');
    expect(getTxMatchData(null)).toBe('0x');
  });

  it('moves top-level tx fields into Tempo calls', () => {
    const tempoTx = toTempoCallsTx(
      {
        to: userAddress,
        data: '0xabcdef',
        value: 3,
      },
      { stripTopLevelData: true },
    );

    expect(tempoTx).toMatchObject({
      type: '0x76',
      calls: [{ to: userAddress, data: '0xabcdef', value: '0x3' }],
    });
    expect(tempoTx).not.toHaveProperty('to');
    expect(tempoTx).not.toHaveProperty('value');
    expect(tempoTx).not.toHaveProperty('data');
  });

  it('keeps explicit calls and normalizes empty call data', () => {
    const tempoTx = toTempoCallsTx({
      to: userAddress,
      data: '0xparent',
      value: '0x',
      calls: [{ data: '', value: 10n }, { to: usdcTokenId }],
    });

    expect(tempoTx.calls).toEqual([
      { to: userAddress, value: '0xa' },
      { to: usdcTokenId, data: '0xparent', value: '0x0' },
    ]);
  });

  it('builds a Tempo tx with fee payer metadata and stripped calldata', () => {
    const tempoTx = buildTempoTransaction(
      {
        to: userAddress,
        data: '0xabcdef',
        value: '0x1',
        feePayerSignature: null,
        feeToken: usdcTokenId,
      },
      { feePayer: true },
    );

    expect(tempoTx).toMatchObject({
      type: '0x76',
      feePayer: true,
      feeToken: usdcTokenId,
      calls: [{ to: userAddress, data: '0xabcdef', value: '0x1' }],
    });
    expect(tempoTx).not.toHaveProperty('data');
    expect(tempoTx.feePayerSignature).toBeUndefined();
  });

  it('builds Tempo batch calls in original tx order from the last tx base', () => {
    const batchTx = buildTempoBatchTransaction([
      { to: '0x0000000000000000000000000000000000000001', data: '0x01' },
      {
        to: '0x0000000000000000000000000000000000000002',
        data: '0x02',
        feeToken: usdcTokenId,
      },
    ]);

    expect(batchTx.type).toBe('0x76');
    expect(batchTx.feeToken).toBe(usdcTokenId);
    expect(batchTx.calls).toEqual([
      {
        to: '0x0000000000000000000000000000000000000001',
        data: '0x01',
        value: '0x0',
      },
      {
        to: '0x0000000000000000000000000000000000000002',
        data: '0x02',
        value: '0x0',
      },
    ]);
  });

  it('rejects empty Tempo batches', () => {
    expect(() => buildTempoBatchTransaction([])).toThrow(
      'tempo batch transaction requires at least one tx',
    );
  });
});

describe('tempo fee token helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves Tempo default token ids without leaking native chain ids', () => {
    expect(
      resolveTempoDefaultTokenId({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        tokenId: undefined,
        nativeTokenId: TEMPO_CHAIN_SERVER_ID,
      }),
    ).toBe(TEMPO_PATH_USD_TOKEN);
    expect(
      resolveTempoDefaultTokenId({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        tokenId: TEMPO_CHAIN_SERVER_ID,
        nativeTokenId: TEMPO_CHAIN_SERVER_ID,
      }),
    ).toBe(TEMPO_PATH_USD_TOKEN);
    expect(
      resolveTempoDefaultTokenId({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        tokenId: usdcTokenId,
        nativeTokenId: TEMPO_CHAIN_SERVER_ID,
      }),
    ).toBe(usdcTokenId);
    expect(
      resolveTempoDefaultTokenId({
        chainServerId: 'eth',
        tokenId: '',
        nativeTokenId: 'eth',
      }),
    ).toBe('eth');
  });

  it('loads the fee token address from fee-manager selectors with fallback', async () => {
    mockRequestReadOnlyETHRpc
      .mockRejectedValueOnce(new Error('selector unavailable'))
      .mockResolvedValueOnce(
        encodedAddressResult('0x0000000000000000000000000000000000000000'),
      )
      .mockResolvedValueOnce(encodedAddressResult(usdtTokenId));

    await expect(
      getTempoFeeTokenAddress({
        account,
        userAddress,
        chainServerId: TEMPO_CHAIN_SERVER_ID,
      }),
    ).resolves.toBe(usdtTokenId.toLowerCase());

    expect(mockRequestReadOnlyETHRpc).toHaveBeenCalledTimes(3);
  });

  it('falls back to pathUSD when the user address is invalid', async () => {
    await expect(
      getTempoFeeTokenAddress({
        account,
        userAddress: 'not-an-address',
        chainServerId: TEMPO_CHAIN_SERVER_ID,
      }),
    ).resolves.toBe(TEMPO_PATH_USD_TOKEN);
    expect(mockRequestReadOnlyETHRpc).not.toHaveBeenCalled();
  });

  it('uses OpenAPI token metadata after resolving the fee token address', async () => {
    mockRequestReadOnlyETHRpc.mockResolvedValueOnce(
      encodedAddressResult(usdcTokenId),
    );
    mockOpenapi.getToken.mockResolvedValueOnce(
      tokenItem({
        id: usdcTokenId,
        symbol: 'USDC.e',
        display_symbol: 'USDC.e',
        decimals: 6,
        logo_url: 'https://assets.example/usdc.png',
        raw_amount_hex_str: '0xf4240',
      }),
    );

    await expect(
      getTempoFeeTokenInfo({
        account,
        userAddress,
        chainServerId: TEMPO_CHAIN_SERVER_ID,
      }),
    ).resolves.toEqual({
      tokenId: usdcTokenId.toLowerCase(),
      symbol: 'USDC.e',
      decimals: 6,
      logoUrl: 'https://assets.example/usdc.png',
      rawBalanceHex: '0xf4240',
    });
  });

  it('filters cached fee-token options by whitelist and gas balance', () => {
    const options = listTempoFeeTokenOptionsFromCache({
      tokenList: [
        tokenItem({
          id: usdcTokenId,
          symbol: 'Wrong symbol from cache',
          raw_amount_hex_str: '0xf4240',
          usd_value: 5,
        }),
        tokenItem({
          id: usdtTokenId,
          symbol: 'USDT0',
          raw_amount_hex_str: '0x1',
          usd_value: 100,
        }),
        tokenItem({
          id: '0x3333333333333333333333333333333333333333',
          symbol: 'NOT_ALLOWED',
          raw_amount_hex_str: '0xffff',
          usd_value: 1000,
        }),
        tokenItem({
          chain: 'eth',
          id: TEMPO_PATH_USD_TOKEN,
          symbol: 'pathUSD',
          raw_amount_hex_str: '0xffff',
          usd_value: 1000,
        }),
      ],
      chainServerId: TEMPO_CHAIN_SERVER_ID,
      maxGasCostRawAmount: '1000000',
      maxGasCostRawAmountDecimals: 6,
    });

    expect(options).toHaveLength(5);
    expect(options[0]).toMatchObject({
      id: usdcTokenId,
      symbol: 'USDC.e',
      isDisabledByTempoGasBalance: false,
    });
    expect(
      findTempoFeeTokenOption(options, usdtTokenId.toLowerCase()),
    ).toMatchObject({
      symbol: 'USDT0',
      isDisabledByTempoGasBalance: true,
    });
    expect(
      findTempoFeeTokenOption(
        options,
        '0x3333333333333333333333333333333333333333',
      ),
    ).toBeUndefined();
  });

  it('checks cached gas balances against 18-decimal gas requirements', () => {
    const options = listTempoFeeTokenOptionsFromCache({
      tokenList: [
        tokenItem({
          id: usdcTokenId,
          raw_amount_hex_str: '0xf4240',
          usd_value: 5,
        }),
      ],
      maxGasCostRawAmountIn18: '1000000000000000000',
    });

    expect(findTempoFeeTokenOption(options, usdcTokenId)).toMatchObject({
      isDisabledByTempoGasBalance: false,
    });
    expect(
      findTempoFeeTokenOption(options, TEMPO_PATH_USD_TOKEN),
    ).toMatchObject({
      isDisabledByTempoGasBalance: true,
    });
  });

  it('lists async fee-token options from listToken, getToken, and current fallback', async () => {
    mockOpenapi.listToken.mockResolvedValueOnce([
      tokenItem({
        id: usdcTokenId,
        symbol: 'ignored',
        raw_amount_hex_str: '0xf4240',
        usd_value: 2,
      }),
    ]);
    mockOpenapi.getToken
      .mockRejectedValueOnce(new Error('missing USDT0'))
      .mockResolvedValueOnce(
        tokenItem({
          id: TEMPO_PATH_USD_TOKEN,
          symbol: 'pathUSD',
          raw_amount_hex_str: '0x2',
        }),
      )
      .mockRejectedValue(new Error('missing token'));

    const options = await listTempoFeeTokenOptions({
      account,
      userAddress,
      chainServerId: TEMPO_CHAIN_SERVER_ID,
      currentFeeTokenInfo: {
        tokenId: usdtTokenId,
        symbol: 'USDT0',
        decimals: 6,
        logoUrl: '',
        rawBalanceHex: '0x64',
      },
      maxGasCostRawAmount: '10',
      maxGasCostRawAmountDecimals: 6,
    });

    expect(mockOpenapi.listToken).toHaveBeenCalledWith(
      userAddress,
      TEMPO_CHAIN_SERVER_ID,
      true,
    );
    expect(options).toHaveLength(5);
    expect(findTempoFeeTokenOption(options, usdcTokenId)).toMatchObject({
      symbol: 'USDC.e',
      isDisabledByTempoGasBalance: false,
    });
    expect(findTempoFeeTokenOption(options, usdtTokenId)).toMatchObject({
      symbol: 'USDT0',
      raw_amount_hex_str: '0x64',
      isDisabledByTempoGasBalance: false,
    });
    expect(
      findTempoFeeTokenOption(options, TEMPO_PATH_USD_TOKEN),
    ).toMatchObject({
      symbol: 'pathUSD',
      raw_amount_hex_str: '0x2',
      isDisabledByTempoGasBalance: true,
    });
  });

  it('resolves preferred fee tokens and selects enabled cached options', async () => {
    expect(
      resolveTempoPreferredFeeTokenId({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        txFeeToken: '',
        currentFeeTokenId: '',
      }),
    ).toBe(TEMPO_PATH_USD_TOKEN);
    expect(
      resolveTempoPreferredFeeTokenId({
        chainServerId: TEMPO_CHAIN_SERVER_ID,
        txFeeToken: usdcTokenId,
        currentFeeTokenId: usdtTokenId,
      }),
    ).toBe(usdcTokenId);

    const state = await loadTempoFeeTokenOptionsState({
      account,
      chainServerId: TEMPO_CHAIN_SERVER_ID,
      txFeeToken: usdcTokenId,
      tokenList: [
        tokenItem({
          id: usdcTokenId,
          raw_amount_hex_str: '0x64',
          usd_value: 1,
        }),
      ],
      maxGasCostRawAmount: '10',
      maxGasCostRawAmountDecimals: 6,
    });

    expect(state.options).toEqual([]);
    expect(state.preferredTokenId).toBe(usdcTokenId);
    expect(state.selectedOption).toMatchObject({
      id: usdcTokenId,
      isDisabledByTempoGasBalance: false,
    });
  });
});
