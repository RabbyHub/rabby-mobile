import {
  BRIDGE_ERRORS,
  BridgeError,
  InvalidBridgeCalldataError,
  InvalidBridgeContractError,
  getBridgeRouter,
} from '@rabby-wallet/rabby-bridge';
import { GAS_ACCOUNT_BRIDGE_COLLECTION_ADDRESS } from '@/constant/gas-account';
import {
  validateGasAccountDepositBridgeQuote,
  validatePerpsDepositBridgeQuote,
} from './depositBridgeValidation';

const mockReportBridgeSdkError = jest.fn();

jest.mock('@/core/bridgeSdkReport', () => ({
  reportBridgeSdkError: (...args: unknown[]) =>
    mockReportBridgeSdkError(...args),
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

const buildAcrossDepositV3Tx = ({
  from = USER_ADDRESS,
  depositor = USER_ADDRESS,
  recipient = ACROSS_HYPERCORE_HANDLER,
  inputToken = ARB_USDC,
  outputToken = HYPEREVM_USDC,
  inputAmount = 10_000_000,
  outputAmount = 9_950_000,
  destChainId = 999,
  message = buildHyperCoreMessage(USER_ADDRESS),
  to = getBridgeRouter('across', 'arb')!,
  value = '0x0',
  chainId = 42161,
}: {
  from?: string;
  depositor?: string;
  recipient?: string;
  inputToken?: string;
  outputToken?: string;
  inputAmount?: number;
  outputAmount?: number;
  destChainId?: number;
  message?: string;
  to?: string;
  value?: string;
  chainId?: number;
} = {}) => ({
  from,
  to,
  value,
  chainId,
  gasLimit: '0x0',
  gasPrice: '0x0',
  data:
    '0x7b939232' +
    [
      depositor,
      recipient,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      destChainId,
      ZERO_ADDRESS,
      1794499200,
      1794501000,
      0,
      384,
    ]
      .map(encodeWord)
      .join('') +
    encodeBytes(message),
});

describe('depositBridgeValidation', () => {
  beforeEach(() => {
    mockReportBridgeSdkError.mockClear();
  });

  it('accepts valid Perps Across HyperCore deposit quote targeting userAddress', () => {
    const tx = buildAcrossDepositV3Tx({
      message: buildHyperCoreMessage(USER_ADDRESS),
    });

    const result = validatePerpsDepositBridgeQuote(
      {
        bridge_id: 'across',
        approve_contract_id: tx.to,
        to_token_raw_amount_hex_str: '0x3b4e9380',
        tx,
      },
      {
        userAddress: USER_ADDRESS,
        fromChainId: 'arb',
        fromTokenId: ARB_USDC,
        fromTokenRawAmount: '10000000',
      },
    );

    expect(result).toMatchObject({
      pass: true,
      routerPass: true,
      fromPass: true,
      receiverPass: true,
      errors: [],
    });
    expect(mockReportBridgeSdkError).not.toHaveBeenCalled();
  });

  it('accepts valid Gas Account Across HyperCore deposit quote targeting collection address', () => {
    const tx = buildAcrossDepositV3Tx({
      message: buildHyperCoreMessage(GAS_ACCOUNT_BRIDGE_COLLECTION_ADDRESS),
    });

    const result = validateGasAccountDepositBridgeQuote(
      {
        bridge_id: 'across',
        approve_contract_id: tx.to,
        to_token_raw_amount_hex_str: '0x3b4e9380',
        tx,
      },
      {
        userAddress: USER_ADDRESS,
        fromChainId: 'arb',
        fromTokenId: ARB_USDC,
        fromTokenRawAmount: '10000000',
      },
    );

    expect(result).toMatchObject({
      pass: true,
      routerPass: true,
      fromPass: true,
      receiverPass: true,
      errors: [],
    });
    expect(mockReportBridgeSdkError).not.toHaveBeenCalled();
  });

  it('rejects Perps quote when receiver is redirected away from userAddress', () => {
    const tx = buildAcrossDepositV3Tx({
      message: buildHyperCoreMessage(ATTACKER_ADDRESS),
    });

    let caught: unknown;
    try {
      validatePerpsDepositBridgeQuote(
        {
          bridge_id: 'across',
          approve_contract_id: tx.to,
          to_token_raw_amount_hex_str: '0x3b4e9380',
          tx,
        },
        {
          userAddress: USER_ADDRESS,
          fromChainId: 'arb',
          fromTokenId: ARB_USDC,
          fromTokenRawAmount: '10000000',
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidBridgeCalldataError);
    expect(
      (caught as InvalidBridgeCalldataError).errors.map(e => e.error_code),
    ).toContain(BRIDGE_ERRORS.RECEIVER_MISMATCH.error_code);
    expect(mockReportBridgeSdkError).toHaveBeenCalledTimes(1);
    expect(mockReportBridgeSdkError).toHaveBeenCalledWith(
      expect.any(Object),
      'perps_deposit',
    );
  });

  it('rejects Gas Account quote when receiver is not the official collection address', () => {
    const tx = buildAcrossDepositV3Tx({
      message: buildHyperCoreMessage(USER_ADDRESS),
    });

    let caught: unknown;
    try {
      validateGasAccountDepositBridgeQuote(
        {
          bridge_id: 'across',
          approve_contract_id: tx.to,
          to_token_raw_amount_hex_str: '0x3b4e9380',
          tx,
        },
        {
          userAddress: USER_ADDRESS,
          fromChainId: 'arb',
          fromTokenId: ARB_USDC,
          fromTokenRawAmount: '10000000',
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidBridgeCalldataError);
    expect(
      (caught as InvalidBridgeCalldataError).errors.map(e => e.error_code),
    ).toContain(BRIDGE_ERRORS.RECEIVER_MISMATCH.error_code);
    expect(mockReportBridgeSdkError).toHaveBeenCalledTimes(1);
    expect(mockReportBridgeSdkError).toHaveBeenCalledWith(
      expect.any(Object),
      'gas_account_deposit',
    );
  });

  it('rejects unsupported aggregator and fake spender/router contracts', () => {
    const tx = buildAcrossDepositV3Tx();

    expect(() =>
      validatePerpsDepositBridgeQuote(
        {
          bridge_id: 'lifi',
          approve_contract_id: tx.to,
          tx,
        },
        {
          userAddress: USER_ADDRESS,
          fromChainId: 'arb',
          fromTokenId: ARB_USDC,
          fromTokenRawAmount: '10000000',
        },
      ),
    ).toThrow(BridgeError);

    expect(() =>
      validatePerpsDepositBridgeQuote(
        {
          bridge_id: 'across',
          approve_contract_id: ATTACKER_ADDRESS,
          tx,
        },
        {
          userAddress: USER_ADDRESS,
          fromChainId: 'arb',
          fromTokenId: ARB_USDC,
          fromTokenRawAmount: '10000000',
        },
      ),
    ).toThrow(InvalidBridgeContractError);

    expect(mockReportBridgeSdkError).toHaveBeenCalledTimes(2);
  });

  it('strictly rejects Relay quote when order_data is missing', () => {
    const relayRouter = getBridgeRouter('relay', 'arb')!;
    const depositErc20Data =
      '0x00873348' +
      encodeWord(USER_ADDRESS) +
      encodeWord(ARB_USDC) +
      encodeWord(10_000_000) +
      `0x${'ab'.repeat(32)}`.slice(2);

    let caught: unknown;
    try {
      validateGasAccountDepositBridgeQuote(
        {
          bridge_id: 'relay',
          approve_contract_id: relayRouter,
          to_token_raw_amount_hex_str: '0x3b4e9380',
          tx: {
            from: USER_ADDRESS,
            to: relayRouter,
            value: '0x0',
            chainId: 42161,
            gasLimit: '0x0',
            gasPrice: '0x0',
            data: depositErc20Data,
          },
        },
        {
          userAddress: USER_ADDRESS,
          fromChainId: 'arb',
          fromTokenId: ARB_USDC,
          fromTokenRawAmount: '10000000',
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidBridgeCalldataError);
    expect(
      (caught as InvalidBridgeCalldataError).errors.map(e => e.error_code),
    ).toContain(BRIDGE_ERRORS.MISSING_RELAY_ORDER_DATA.error_code);
    expect(mockReportBridgeSdkError).toHaveBeenCalledTimes(1);
  });
});
