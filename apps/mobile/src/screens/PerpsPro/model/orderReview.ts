import type { PerpsProTradeAmountUnit } from './trade';

export type PerpsProOrderReviewFacts = Readonly<{
  amountUnit: PerpsProTradeAmountUnit;
  displayBase: string;
  displayPair: string;
  formRevision: number;
  generatedAt: number;
  leverage: number;
  marginMode: 'cross' | 'isolated';
  markPrice: string;
  maxLeverage: number;
  midPrice: string;
  pxDecimals: number;
  quoteAsset: string;
  sourceTag: string | null;
  szDecimals: number;
}>;
