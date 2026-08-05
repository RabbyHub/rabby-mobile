import type { HYPE_SEND_ASSET_TOKEN_MAP } from '@/constant/perps';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';

export interface PerpBridgeHistory {
  from_chain_id: string;
  from_token_id: string;
  from_token_amount: number;
  to_token_amount: number;
  tx: Tx;
}

export type PerpsStableCoin = 'USDH' | 'USDT' | 'USDE';

export interface PerpsStableCoinOrderParams {
  coin: PerpsStableCoin;
  isBuy: boolean;
  limitPx: string;
  size: string;
}

export type PerpsWithdrawTarget = keyof typeof HYPE_SEND_ASSET_TOKEN_MAP;
