import { CHAINS_ENUM } from '@/constant/chains';

export const DEFAULT_PRICE_IMPACT = '10'; // %

export const DEFAULT_MAX_GAS_COST = '0.1'; // usd
export const DEFAULT_ETH_MAX_GAS_COST = '1'; // usd

export const thresholds = [
  { label: '<$0.1', value: 0.1 },
  { label: '<$1', value: 1 },
  { label: '<$10', value: 10 },
  { label: '<$100', value: 100 },
  { label: '<$1000', value: 1000 },
] as const;
export type DustFilter = (typeof thresholds)[number];

export const PRICE_IMPACT_OPTIONS = [
  { label: '5%', value: '5' },
  { label: '10%', value: '10' },
  { label: '15%', value: '15' },
  { label: '20%', value: '20' },
] as const;

export const GAS_LIMIT_OPTIONS = [
  { label: '$0.01', value: '0.01' },
  { label: '$0.05', value: '0.05' },
  { label: '$0.1', value: '0.1' },
  { label: '$1', value: '1' },
] as const;

export const ETH_CHAIN = CHAINS_ENUM.ETH;
