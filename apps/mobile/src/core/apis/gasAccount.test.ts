import {
  InvalidBridgeCalldataError,
  InvalidBridgeContractError,
  getBridgeRouter,
} from '@rabby-wallet/rabby-bridge';
import type { GasAccountBridgeQuote } from '@rabby-wallet/rabby-api/dist/types';
import { GAS_ACCOUNT_BRIDGE_COLLECTION_ADDRESS } from '@/constant/gas-account';
import type { Account } from '@/types/account';
import {
  buildGasAccountBridgeTxs,
  fetchGasAccountBridgeQuote,
  getGasAccountBridgeRawAmount,
} from './gasAccount';

const mockGetGasAccountBridgeQuote = jest.fn();
const mockGetERC20Allowance = jest.fn();
const mockApproveToken = jest.fn();
const mockReportBridgeSdkError = jest.fn();

jest.mock('../request', () => ({
  openapi: {
    getGasAccountBridgeQuote: (...args: unknown[]) =>
      mockGetGasAccountBridgeQuote(...args),
  },
}));

jest.mock('./provider', () => ({
  getERC20Allowance: (...args: unknown[]) => mockGetERC20Allowance(...args),
}));

jest.mock('./approvals', () => ({
  approveToken: (...args: unknown[]) => mockApproveToken(...args),
}));

jest.mock('@/core/bridgeSdkReport', () => ({
  reportBridgeSdkError: (...args: unknown[]) =>
    mockReportBridgeSdkError(...args),
}));

jest.mock('@/utils/chain', () => ({
  findChain: () => ({
    id: 42161,
    serverId: 'arb',
    nativeTokenAddress: 'arb',
  }),
  findChainByServerID: () => ({
    id: 42161,
    serverId: 'arb',
    nativeTokenAddress: 'arb',
  }),
}));

jest.mock('./token', () => ({
  sendToken: jest.fn(),
}));

jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {
    getNonceByChain: jest.fn(),
  },
}));

jest.mock('@/core/serviceApi/gasAccount', () => ({
  gasAccountServiceApi: {
    getGasAccountSig: jest.fn(),
  },
  setGasAccountLastDepositAccount: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

const USER_ADDRESS = '0x1111111111111111111111111111111111111111';
const ATTACKER_ADDRESS = '0x9999999999999999999999999999999999999999';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ARB_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';
const HYPEREVM_USDC = '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb';
const ACROSS_HYPERCORE_HANDLER = '0xbfb53e9c8acce6d6ac54885a8e33a7aec95427d5';

const encodeWord = (value: string | number | bigint) => {
  if (typeof value === 'string' && value.startsWith('0x')) {
    return value.slice(2).toLowerCase().padStart(64, '0');
  }
  return BigInt(value).toString(16).padStart(64, '0');
};

const encodeBytes = (hex: string) => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const byteLength = clean.length / 2;
  const padded = clean.padEnd(Math.ceil(clean.length / 64) * 64, '0');
  return encodeWord(byteLength) + padded;
};

const buildHyperCoreMessage = (recipient: string) =>
  `0x00${'0'.repeat(24)}${recipient.slice(2).toLowerCase()}${'0'.repeat(64)}`;

const buildQuote = ({
  receiver = GAS_ACCOUNT_BRIDGE_COLLECTION_ADDRESS,
  approveContractId,
  inputAmount = 10_000_000,
}: {
  receiver?: string;
  approveContractId?: string;
  inputAmount?: number;
} = {}): GasAccountBridgeQuote => {
  const router = getBridgeRouter('across', 'arb')!;
  const data =
    '0x7b939232' +
    [
      USER_ADDRESS,
      ACROSS_HYPERCORE_HANDLER,
      ARB_USDC,
      HYPEREVM_USDC,
      inputAmount,
      9_950_000,
      999,
      ZERO_ADDRESS,
      1794499200,
      1794501000,
      0,
      384,
    ]
      .map(encodeWord)
      .join('') +
    encodeBytes(buildHyperCoreMessage(receiver));

  return {
    bridge_id: 'across',
    bridge: { logo_url: 'https://example.com/across.png' },
    to_token_raw_amount: 995_000_000,
    to_token_raw_amount_hex_str: '0x3b4e9380',
    to_token_amount: 9.95,
    approve_contract_id: approveContractId ?? router,
    protocol_fee: { raw_amount_hex_str: '0x0', usd_value: 0 },
    rabby_fee: { raw_amount_hex_str: '0x0', usd_value: 0 },
    gas_fee: { raw_amount_hex_str: '0x0', usd_value: 0 },
    duration: 10,
    tx: {
      from: USER_ADDRESS,
      to: router,
      value: '0x0',
      data,
      chainId: 42161,
    } as GasAccountBridgeQuote['tx'],
  };
};

const ACCOUNT = { address: USER_ADDRESS } as Account;
const TOKEN = {
  chain: 'arb',
  id: ARB_USDC,
  decimals: 6,
  price: 1,
};

describe('gasAccount bridge deposit validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetERC20Allowance.mockResolvedValue('0');
    mockApproveToken.mockResolvedValue({
      params: [{ from: USER_ADDRESS, to: ARB_USDC, data: '0x095ea7b3' }],
    });
  });

  it('validates and returns a valid Gas Account bridge quote', async () => {
    const quote = buildQuote();
    mockGetGasAccountBridgeQuote.mockResolvedValue(quote);

    const res = await fetchGasAccountBridgeQuote({
      token: TOKEN,
      account: ACCOUNT,
      usdValue: 10,
    });

    expect(res).toBe(quote);
    expect(mockReportBridgeSdkError).not.toHaveBeenCalled();
  });

  it('rejects a tampered Gas Account bridge quote during fetch', async () => {
    const tamperedQuote = buildQuote({ receiver: ATTACKER_ADDRESS });
    mockGetGasAccountBridgeQuote.mockResolvedValue(tamperedQuote);

    await expect(
      fetchGasAccountBridgeQuote({
        token: TOKEN,
        account: ACCOUNT,
        usdValue: 10,
      }),
    ).rejects.toThrow(InvalidBridgeCalldataError);
    expect(mockReportBridgeSdkError).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid spender in buildGasAccountBridgeTxs before checking allowance or approving', async () => {
    const tamperedQuote = buildQuote({ approveContractId: ATTACKER_ADDRESS });

    await expect(
      buildGasAccountBridgeTxs({
        token: TOKEN,
        account: ACCOUNT,
        quote: tamperedQuote,
        usdValue: 10,
      }),
    ).rejects.toThrow(InvalidBridgeContractError);

    expect(mockGetERC20Allowance).not.toHaveBeenCalled();
    expect(mockApproveToken).not.toHaveBeenCalled();
    expect(mockReportBridgeSdkError).toHaveBeenCalledTimes(1);
  });

  it('builds approve and bridge txs using the quoted fromTokenRawAmount even if token price drifts', async () => {
    const rawAmount = getGasAccountBridgeRawAmount({
      token: TOKEN,
      usdValue: 10,
    });
    const quote = buildQuote({ inputAmount: Number(rawAmount) });

    const txs = await buildGasAccountBridgeTxs({
      token: { ...TOKEN, price: 1.05 },
      account: ACCOUNT,
      quote,
      usdValue: 10,
      fromTokenRawAmount: rawAmount,
    });

    expect(txs).toHaveLength(2);
    expect(mockApproveToken).toHaveBeenCalledWith(
      expect.objectContaining({
        spender: quote.approve_contract_id,
        amount: rawAmount,
      }),
    );
    expect(mockReportBridgeSdkError).not.toHaveBeenCalled();
  });
});
