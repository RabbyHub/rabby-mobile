export interface PerpsProCloseMarketSnapshot {
  displayBase: string;
  displayPair: string;
  markPrice: string;
  midPrice: string;
  pxDecimals: number;
  quoteAsset: string;
  szDecimals: number;
}

export interface PerpsProCloseDraft {
  limitPrice: string | null;
  orderType: 'limit' | 'market';
  percent: number;
  size: string;
}
