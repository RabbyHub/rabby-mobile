import type {
  UserHistoricalOrders,
  UserNonFundingLedgerUpdates,
} from '@rabby-wallet/hyperliquid-sdk';

export type PerpsProHistoryTab = 'orders' | 'trade' | 'transaction' | 'funding';

export type PerpsProHistoryStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

export type PerpsProHistoryWindow = Readonly<{
  endTime: number;
  startTime: number;
}>;

export type PerpsProHistoryMarket = Readonly<{
  coin: string;
  displayBase: string;
  displayPair: string;
  logoUrl: string | null;
  pxDecimals: number | null;
  quoteAsset: string;
  sourceTag: string | null;
  szDecimals: number | null;
}>;

export interface PerpsProOrderHistoryRow {
  amountBase: string | null;
  amountQuote: string | null;
  executionPrice: string | null;
  filledBase: string | null;
  filledQuote: string | null;
  isTrigger: boolean;
  key: string;
  kind: 'orders';
  market: PerpsProHistoryMarket;
  oid: number;
  orderType: string;
  price: string | null;
  priceKind: 'limit' | 'market';
  reduceOnly: boolean;
  remainingBase: string | null;
  side: 'buy' | 'sell';
  status: string;
  tif: string | null;
  time: number;
}

export interface PerpsProTradeHistoryRow {
  direction: string;
  fee: string;
  feeToken: string;
  filledBase: string;
  filledQuote: string;
  hash: string;
  isLiquidation: boolean;
  key: string;
  kind: 'trade';
  market: PerpsProHistoryMarket;
  netRealizedPnl: string;
  oid: number;
  price: string;
  side: 'buy' | 'sell';
  tid: number;
  time: number;
}

export interface PerpsProTransactionHistoryRow {
  amount: string;
  asset: string;
  assetAmountSource?: 'explicit' | 'legacyUsdc' | 'local';
  direction: 'deposit' | 'withdraw';
  hash: string;
  key: string;
  kind: 'transaction';
  rawType: string;
  settlementNonce?: number;
  status: 'failed' | 'pending' | 'success';
  time: number;
}

export interface PerpsProFundingHistoryRow {
  amount: string;
  fundingRate: string;
  hash: string | null;
  key: string;
  kind: 'funding';
  market: PerpsProHistoryMarket;
  positionSide: 'long' | 'short';
  positionSize: string;
  time: number;
}

export type PerpsProHistoryRow =
  | PerpsProOrderHistoryRow
  | PerpsProTradeHistoryRow
  | PerpsProTransactionHistoryRow
  | PerpsProFundingHistoryRow;

export interface PerpsProHistoryTabState<
  Row extends PerpsProHistoryRow = PerpsProHistoryRow,
> {
  coveredWindow?: PerpsProHistoryWindow;
  error?: string;
  hasEarlier: boolean;
  loadingEarlier: boolean;
  loadEarlierError?: string;
  oldestLoadedTime?: number;
  refreshing: boolean;
  rows: Row[];
  status: PerpsProHistoryStatus;
}

export type PerpsProHistoryState = {
  funding: PerpsProHistoryTabState<PerpsProFundingHistoryRow>;
  orders: PerpsProHistoryTabState<PerpsProOrderHistoryRow>;
  trade: PerpsProHistoryTabState<PerpsProTradeHistoryRow>;
  transaction: PerpsProHistoryTabState<PerpsProTransactionHistoryRow>;
};

export interface PerpsProFundingFact {
  coin: string;
  fundingRate: string;
  hash?: string;
  szi: string;
  time: number;
  usdc: string;
}

export type PerpsProLedgerFact = UserNonFundingLedgerUpdates & {
  delta: UserNonFundingLedgerUpdates['delta'] & {
    amount?: string;
    destination?: string;
    destinationDex?: string;
    nonce?: number;
    source?: string;
    sourceDex?: string;
    token?: string;
    toPerp?: boolean;
    user?: string;
    usdc?: string;
    usdcValue?: string;
  };
};

export type PerpsProHistoryOrderFact = UserHistoricalOrders;
