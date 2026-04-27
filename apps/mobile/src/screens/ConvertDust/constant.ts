import { CHAINS_ENUM } from '@/constant/chains';

export const DEFAULT_PRICE_IMPACT = '10'; // %

export const DEFAULT_MAX_GAS_COST = '0.1'; // usd
export const DEFAULT_ETH_MAX_GAS_COST = '1'; // usd

export const DUST_FILTERS = [
  '<$0.1',
  '<$1',
  '<$10',
  '<$100',
  '<$1000',
] as const;
export type DustFilter = (typeof DUST_FILTERS)[number];

export const PRICE_IMPACT_OPTIONS = ['1%', '3%', '10%', '20%'] as const;
export const GAS_LIMIT_OPTIONS = ['$0.01', '$0.05', '$0.1', '$1'] as const;

export const DUST_FILTER_VALUE_MAP: Record<DustFilter, number> = {
  '<$0.1': 0.1,
  '<$1': 1,
  '<$10': 10,
  '<$100': 100,
  '<$1000': 1000,
};

export const ETH_CHAIN = CHAINS_ENUM.ETH;
