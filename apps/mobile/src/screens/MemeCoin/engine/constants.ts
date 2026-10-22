import type { FailReason } from './types';

export const ETH_MAINNET_SERVER_ID = 'eth';

export const MAINSTREAM_STABLE_SYMBOLS = [
  'USDT',
  'USDC',
  'DAI',
  'USDE',
  'FDUSD',
  'USD1',
];

export const AMOUNT_EPSILON = 1e-9;

export const BRIDGE_ARRIVAL_POLL_INTERVAL_MS = 3 * 1000;

export const AUTO_LOCK_REFRESH_INTERVAL_MS = 60 * 1000;

export const FAIL_REASON_I18N_KEY: Record<FailReason, string> = {
  noQuote: 'page.swap.no-quote-found',
  priceImpact: 'page.convertDust.failReason.priceImpactTooHigh',
  gasNotEnough: 'page.convertDust.failReason.gasNotEnough',
  gasTooHigh: 'page.convertDust.failReason.gasCostTooHigh',
  simulationFailed: 'page.signTx.swap.simulationFailed',
  insufficientBalance: 'page.swap.insufficient-balance',
  failed: 'global.failed',
};
