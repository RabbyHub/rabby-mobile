import { validateDepositBridgeQuote } from '@rabby-wallet/rabby-bridge';
import type {
  BridgeValidationResult,
  DepositBridgeQuote,
} from '@rabby-wallet/rabby-bridge';
import { GAS_ACCOUNT_BRIDGE_COLLECTION_ADDRESS } from '@/constant/gas-account';
import { reportBridgeSdkError } from '@/core/bridgeSdkReport';

export const DEPOSIT_BRIDGE_TO_CHAIN_ID = 'hyperliquid';
export const DEPOSIT_BRIDGE_TO_TOKEN_ID = '0x00000000000000000000000000000000';
export const DEPOSIT_BRIDGE_DEFAULT_SLIPPAGE = '0.01';

export interface DepositBridgeValidationInput {
  userAddress: string;
  fromChainId: string;
  fromTokenId: string;
  fromTokenRawAmount: string;
  slippage?: string | number;
}

export const validatePerpsDepositBridgeQuote = (
  quote: DepositBridgeQuote,
  params: DepositBridgeValidationInput,
): BridgeValidationResult => {
  return validateDepositBridgeQuote(quote, {
    userAddress: params.userAddress,
    receiverAddress: params.userAddress,
    fromChainId: params.fromChainId,
    fromTokenId: params.fromTokenId,
    fromTokenRawAmount: params.fromTokenRawAmount,
    toChainId: DEPOSIT_BRIDGE_TO_CHAIN_ID,
    toTokenId: DEPOSIT_BRIDGE_TO_TOKEN_ID,
    slippage: params.slippage ?? DEPOSIT_BRIDGE_DEFAULT_SLIPPAGE,
    onError: report => reportBridgeSdkError(report, 'perps_deposit'),
  });
};

export const validateGasAccountDepositBridgeQuote = (
  quote: DepositBridgeQuote,
  params: DepositBridgeValidationInput,
): BridgeValidationResult => {
  return validateDepositBridgeQuote(quote, {
    userAddress: params.userAddress,
    receiverAddress: GAS_ACCOUNT_BRIDGE_COLLECTION_ADDRESS,
    fromChainId: params.fromChainId,
    fromTokenId: params.fromTokenId,
    fromTokenRawAmount: params.fromTokenRawAmount,
    toChainId: DEPOSIT_BRIDGE_TO_CHAIN_ID,
    toTokenId: DEPOSIT_BRIDGE_TO_TOKEN_ID,
    slippage: params.slippage ?? DEPOSIT_BRIDGE_DEFAULT_SLIPPAGE,
    onError: report => reportBridgeSdkError(report, 'gas_account_deposit'),
  });
};
