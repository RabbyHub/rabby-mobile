import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';

import { openExternalUrl } from '@/core/utils/linking';
import {
  calcMaxPriorityFee,
  calcTokenValue,
  checkGasAndNonce,
  convert1559ToLegacy,
  convertLegacyTo1559,
  formatTxExplainAbiData,
  formatTxInputDataOnERC20,
  getCustomTxParamsData,
  getKRCategoryByType,
  getTokenAddressParam,
  getTokenData,
  is1559Tx,
  is7702Tx,
  makeTransactionId,
  openTxExternalUrl,
  txResultToDisplayTxItems,
  validateGasPriceRange,
  varyTxSignType,
} from '../transaction';

jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: {
    ETH: 'ETH',
    BOBA: 'BOBA',
    OP: 'OP',
    BASE: 'BASE',
    ZORA: 'ZORA',
    ERA: 'ERA',
    KAVA: 'KAVA',
    ARBITRUM: 'ARBITRUM',
    AURORA: 'AURORA',
    BSC: 'BSC',
    AVAX: 'AVAX',
    POLYGON: 'POLYGON',
    FTM: 'FTM',
    GNOSIS: 'GNOSIS',
    OKT: 'OKT',
    HECO: 'HECO',
    CELO: 'CELO',
    MOVR: 'MOVR',
    CRO: 'CRO',
    BTT: 'BTT',
    METIS: 'METIS',
  },
}));

jest.mock('@/constant/gas', () => ({
  DEFAULT_GAS_LIMIT_RATIO: 1.1,
  MINIMUM_GAS_LIMIT: 21000,
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_CATEGORY_MAP: {
    HDKeyring: 'mnemonic',
    WatchAddressKeyring: 'watch',
  },
}));

jest.mock('../chain', () => ({
  findChain: jest.fn(({ id }: { id?: number }) => {
    if (id === 1) {
      return { enum: 'ETH', serverId: 'eth' };
    }
    if (id === 137) {
      return { enum: 'POLYGON', serverId: 'matic' };
    }
    return null;
  }),
  getChain: jest.fn((chain: string) =>
    chain === 'eth'
      ? {
          serverId: 'eth',
          scanLink: 'https://etherscan.io',
        }
      : null,
  ),
}));

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    t: jest.fn((key: string, params?: unknown[]) =>
      params?.length ? `${key}:${params.join(',')}` : key,
    ),
  },
}));

jest.mock('../tempo', () => ({
  isTempoChain: jest.fn(() => false),
}));

jest.mock('@/core/utils/linking', () => ({
  openExternalUrl: jest.fn(url => `opened:${url}`),
}));

jest.mock('@/databases/entities/historyItem', () => ({
  HistoryItemEntity: class HistoryItemEntity {
    static fillEntity = jest.fn();
  },
}));

jest.mock('@/core/services', () => ({
  preferenceService: {},
  transactionHistoryService: {},
}));

jest.mock('@/core/services/transactionHistory', () => ({
  CustomTxItem: class CustomTxItem {},
}));

jest.mock('@/utils/historyDisplay', () => ({
  ensureHistoryListItemFromDb: jest.fn(item => item),
}));

jest.mock('@/types/history', () => ({
  CUSTOM_HISTORY_TITLE_TYPE: {},
  HistoryItemCateType: {
    Swap: 'Swap',
    UnKnown: 'UnKnown',
  },
}));

jest.mock('i18next', () => ({
  t: jest.fn((key: string) => key),
}));

jest.mock('../text', () => ({
  ellipsisOverflowedText: jest.fn((text: string) => text),
}));

jest.mock('../token', () => ({
  getTokenSymbol: jest.fn(token => token?.symbol || ''),
}));

const baseTx = {
  chainId: 1,
  from: '0x0000000000000000000000000000000000000001',
  to: '0x0000000000000000000000000000000000000002',
  value: '0',
  data: '0x',
  gas: '0x5208',
  nonce: '0x1',
} as any;

const makeGasCheckInput = (overrides = {}) =>
  ({
    recommendGasLimitRatio: 1.1,
    nativeTokenBalance: '1000000000000000000',
    recommendGasLimit: 100000,
    recommendNonce: 5,
    tx: { chainId: 1, value: '0' },
    gasLimit: 120000,
    nonce: 5,
    gasExplainResponse: {
      gasCostUsd: new BigNumber(0),
      gasCostAmount: new BigNumber(0),
      maxGasCostAmount: new BigNumber(0),
      maxGasCostRawAmount: new BigNumber(0),
    },
    isCancel: false,
    isSpeedUp: false,
    isGnosisAccount: false,
    ...overrides,
  } as Parameters<typeof checkGasAndNonce>[0]);

describe('transaction utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('transaction type helpers', () => {
    it('detects EIP-1559 transactions only when both fee fields are valid hex strings', () => {
      expect(
        is1559Tx({
          maxFeePerGas: '0x1',
          maxPriorityFeePerGas: '0x2',
        } as any),
      ).toBe(true);
      expect(
        is1559Tx({ maxFeePerGas: '1', maxPriorityFeePerGas: '0x2' } as any),
      ).toBe(false);
      expect(is1559Tx({ maxFeePerGas: '0x1' } as any)).toBe(false);
    });

    it('detects EIP-7702 transactions from a non-empty authorizationList', () => {
      expect(is7702Tx({ authorizationList: [{}] } as any)).toBe(true);
      expect(is7702Tx({ authorizationList: [] } as any)).toBe(false);
      expect(is7702Tx({} as any)).toBe(false);
    });

    it('validates chain gas price ranges and ignores unknown chains', () => {
      expect(validateGasPriceRange({ chainId: 1, gasPrice: 20e9 } as any)).toBe(
        true,
      );
      expect(() =>
        validateGasPriceRange({ chainId: 1, gasPrice: 20001e9 } as any),
      ).toThrow('GasPrice too high');
      expect(
        validateGasPriceRange({ chainId: 999, gasPrice: 999e9 } as any),
      ).toBe(true);
    });
  });

  describe('transaction shape conversions', () => {
    it('converts EIP-1559 transactions to legacy shape', () => {
      expect(
        convert1559ToLegacy({
          ...baseTx,
          maxFeePerGas: '0x3',
          maxPriorityFeePerGas: '0x1',
        }),
      ).toEqual({
        chainId: 1,
        from: baseTx.from,
        to: baseTx.to,
        value: '0',
        data: '0x',
        gas: '0x5208',
        gasPrice: '0x3',
        nonce: '0x1',
      });
    });

    it('converts legacy transactions to EIP-1559 shape', () => {
      expect(convertLegacyTo1559({ ...baseTx, gasPrice: '0x4' })).toEqual({
        chainId: 1,
        from: baseTx.from,
        to: baseTx.to,
        value: '0',
        data: '0x',
        gas: '0x5208',
        maxFeePerGas: '0x4',
        maxPriorityFeePerGas: '0x4',
        nonce: '0x1',
      });
    });

    it('formats transaction ids with normalized nonce prefixes', () => {
      expect(makeTransactionId(baseTx.from, 10, 'ETH')).toBe(
        `${baseTx.from}_0xa_ETH`,
      );
      expect(makeTransactionId(baseTx.from, '0x0a', 'ETH')).toBe(
        `${baseTx.from}_0x0a_ETH`,
      );
      expect(makeTransactionId(baseTx.from, '10', 'ETH')).toBe(
        `${baseTx.from}_0x10_ETH`,
      );
    });
  });

  describe('gas and keyring helpers', () => {
    it('maps keyring types to categories and unknown types to null', () => {
      expect(getKRCategoryByType('HDKeyring')).toBe('mnemonic');
      expect(getKRCategoryByType('Unknown')).toBe(null);
    });

    it('caps max priority fee at target gas price', () => {
      expect(
        calcMaxPriorityFee(
          [],
          { price: 30, priority_price: 10 } as any,
          1,
          true,
        ),
      ).toBe(10);
      expect(
        calcMaxPriorityFee(
          [],
          { price: 30, priority_price: 40 } as any,
          1,
          true,
        ),
      ).toBe(30);
      expect(
        calcMaxPriorityFee(
          [],
          { price: 30, priority_price: null } as any,
          1,
          true,
        ),
      ).toBe(30);
    });

    it('returns gas and nonce validation errors with stable error codes', () => {
      expect(checkGasAndNonce(makeGasCheckInput())).toEqual([]);
      expect(
        checkGasAndNonce(makeGasCheckInput({ gasLimit: 20000 })).map(
          error => error.code,
        ),
      ).toEqual([3006]);
      expect(
        checkGasAndNonce(makeGasCheckInput({ gasLimit: 90000 })).map(
          error => error.code,
        ),
      ).toEqual([3005]);
      expect(
        checkGasAndNonce(makeGasCheckInput({ nonce: 4 })).map(
          error => error.code,
        ),
      ).toEqual([3003]);
      expect(
        checkGasAndNonce(
          makeGasCheckInput({
            nativeTokenBalance: '1',
            gasExplainResponse: {
              gasCostUsd: new BigNumber(0),
              gasCostAmount: new BigNumber(0),
              maxGasCostAmount: new BigNumber(0),
              maxGasCostRawAmount: new BigNumber(2),
            },
          }),
        ).map(error => error.code),
      ).toEqual([3001]);
    });
  });

  describe('ERC20 calldata helpers', () => {
    const spender = '0x00000000000000000000000000000000000000aa';
    const token = '0x00000000000000000000000000000000000000bb';

    it('parses ERC20 transaction data and extracts the address argument', () => {
      const iface = new ethers.utils.Interface([
        'function transfer(address to,uint256 amount)',
      ]);
      const data = iface.encodeFunctionData('transfer', [spender, 1]);
      const tokenData = getTokenData(data)!;

      expect(tokenData.name).toBe('transfer');
      expect(getTokenAddressParam(tokenData)).toBe(spender.toLowerCase());
      expect(getTokenData('0x1234')).toBeUndefined();
    });

    it('calculates raw token values from human-readable amounts and decimals', () => {
      expect(calcTokenValue('12.34', 6).toFixed()).toBe('12340000');
      expect(calcTokenValue('1', 18).toFixed()).toBe('1000000000000000000');
    });

    it('rewrites ERC20 approve calldata with a custom allowance amount', () => {
      const iface = new ethers.utils.Interface([
        'function approve(address spender,uint256 amount)',
      ]);
      const data = iface.encodeFunctionData('approve', [spender, 1]);
      const nextData = getCustomTxParamsData(data, {
        customPermissionAmount: '12.34',
        decimals: 6,
      });

      expect(
        iface.decodeFunctionData('approve', nextData).spender.toLowerCase(),
      ).toBe(spender);
      expect(
        iface.decodeFunctionData('approve', nextData).amount.toString(),
      ).toBe('12340000');
    });

    it('rewrites increaseAllowance calldata with a custom increment amount', () => {
      const iface = new ethers.utils.Interface([
        'function increaseAllowance(address spender,uint256 increment)',
      ]);
      const data = iface.encodeFunctionData('increaseAllowance', [spender, 1]);
      const nextData = getCustomTxParamsData(data, {
        customPermissionAmount: '2',
        decimals: 6,
      });

      expect(
        iface
          .decodeFunctionData('increaseAllowance', nextData)
          .spender.toLowerCase(),
      ).toBe(spender);
      expect(
        iface
          .decodeFunctionData('increaseAllowance', nextData)
          .increment.toString(),
      ).toBe('2000000');
    });

    it('rewrites Permit2 approve calldata and guards uint160 overflow', () => {
      const iface = new ethers.utils.Interface([
        'function approve(address token,address spender,uint160 amount,uint48 expiration)',
      ]);
      const data = iface.encodeFunctionData('approve', [token, spender, 1, 99]);
      const nextData = getCustomTxParamsData(data, {
        customPermissionAmount: '3',
        decimals: 6,
      });

      const decoded = iface.decodeFunctionData('approve', nextData);
      expect(decoded.token).toBe(token);
      expect(decoded.spender.toLowerCase()).toBe(spender);
      expect(decoded.amount.toString()).toBe('3000000');
      expect(decoded.expiration.toString()).toBe('99');

      expect(() =>
        getCustomTxParamsData(data, {
          customPermissionAmount: '1',
          decimals: 49,
        }),
      ).toThrow('Custom value is larger than uint160');
    });

    it('formats optional ERC20 input data as either hex or utf8 text', () => {
      expect(formatTxInputDataOnERC20('')).toEqual({
        withInputData: false,
        currentIsHex: false,
        currentData: '',
        hexData: '',
        utf8Data: '',
      });
      expect(formatTxInputDataOnERC20('0x6869')).toMatchObject({
        withInputData: true,
        currentIsHex: true,
        currentData: 'hi',
        hexData: '0x6869',
        utf8Data: 'hi',
      });
      expect(formatTxInputDataOnERC20('hello')).toMatchObject({
        withInputData: true,
        currentIsHex: false,
        currentData: 'hello',
        hexData: '0x68656c6c6f',
        utf8Data: 'hello',
      });
    });
  });

  describe('display helpers', () => {
    it('classifies analytics category and action by transaction explain type', () => {
      expect(varyTxSignType({ type_send: {} } as any)).toEqual({
        gaCategory: 'Send',
        gaAction: 'signTx',
        isNFT: false,
        isToken: true,
      });
      expect(
        varyTxSignType({ type_cancel_single_nft_approval: {} } as any),
      ).toEqual({
        gaCategory: 'Security',
        gaAction: 'signDeclineNFTApproval',
        isNFT: true,
        isToken: false,
      });
      expect(
        varyTxSignType({
          type_cancel_token_approval: {},
          type_cancel_nft_collection_approval: {},
        } as any),
      ).toEqual({
        gaCategory: 'Security',
        gaAction: 'signDeclineTokenAndNFTApproval',
        isNFT: true,
        isToken: true,
      });
    });

    it('formats explained ABI data with positional argument labels', () => {
      expect(
        formatTxExplainAbiData({
          func: 'transfer',
          params: ['0xabc', 1234],
        } as any),
      ).toBe('transfer(arg0=0xabc, arg1=1234)');
      expect(formatTxExplainAbiData(null)).toBe('()');
    });

    it('sorts displayed transaction items by time descending', () => {
      expect(
        txResultToDisplayTxItems({
          cate_dict: { send: { name: 'Send' } },
          project_dict: { rabby: { name: 'Rabby' } },
          token_dict: { eth: { symbol: 'ETH' } },
          history_list: [
            { id: 'old', time_at: 1 },
            { id: 'new', time_at: 2 },
          ],
        } as any).map(item => item.id),
      ).toEqual(['new', 'old']);
    });

    it('opens transaction and address scan links when chain scan link is available', () => {
      expect(openTxExternalUrl({ chain: null, txHash: '0xhash' })).toEqual({
        canOpen: false,
        openPromise: null,
      });

      const txResult = openTxExternalUrl({ chain: 'eth', txHash: '0xhash' });
      expect(txResult).toEqual({
        canOpen: true,
        openPromise: 'opened:https://etherscan.io/tx/0xhash',
      });

      const addressResult = openTxExternalUrl({
        chain: { scanLink: 'https://etherscan.io' } as any,
        address: baseTx.from,
      });
      expect(addressResult).toEqual({
        canOpen: true,
        openPromise: `opened:https://etherscan.io/address/${baseTx.from}`,
      });
      expect(openExternalUrl).toHaveBeenCalledTimes(2);
    });
  });
});
