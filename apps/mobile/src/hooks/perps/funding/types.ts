import type { HYPE_SEND_ASSET_TOKEN_MAP } from '@/constant/perps';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

export interface PerpBridgeHistory {
  from_chain_id: string;
  from_token_id: string;
  from_token_amount: number;
  to_token_amount: number;
  tx: Tx;
}

export interface PerpsFundingHistoryMetadata {
  amount: string;
  asset: string;
  settlementAmount: string;
  sourceChainId?: string;
  sourceTokenId?: string;
}

export type PerpsFundingRoute = 'direct' | 'provider';

export type PerpsFundingAssetAmountSource = 'explicit' | 'legacyUsdc' | 'local';

export type PerpsFundingProviderSettlementIdentity = Readonly<{
  hash: string;
  kind: 'hyperliquidLedgerHash';
}>;

export type PerpsFundingConfirmation = Readonly<{
  operationId: string;
  providerSettlementIdentity?: PerpsFundingProviderSettlementIdentity;
}>;

export interface AccountHistoryItem {
  time: number;
  hash: string;
  accountAddress?: string;
  accountType?: string;
  amount?: string;
  asset?: string;
  assetAmountSource?: PerpsFundingAssetAmountSource;
  destinationDex?: string;
  fundingRoute?: PerpsFundingRoute;
  operationId?: string;
  settlementAmount?: string;
  settlementNonce?: number;
  sourceChainId?: string;
  sourceHash?: string;
  sourceTokenId?: string;
  type: 'deposit' | 'withdraw' | 'receive' | 'transfer';
  status: 'pending' | 'success' | 'failed';
  usdValue: string;
}

export interface PerpsDepositOptions {
  history?: PerpsFundingHistoryMetadata;
  isHypeDeposit?: boolean;
  skipHistory?: boolean;
}

export type PerpsStableCoin = 'USDH' | 'USDT' | 'USDE';

export interface PerpsStableCoinOrderParams {
  coin: PerpsStableCoin;
  isBuy: boolean;
  limitPx: string;
  size: string;
}

export type PerpsWithdrawTarget = keyof typeof HYPE_SEND_ASSET_TOKEN_MAP;
