import type { FailReason } from './types';

export const ETH_MAINNET_SERVER_ID = 'eth';

export const AMOUNT_EPSILON = 1e-9;

/** USD reserved per leg until the real gas of a chain is known */
export const DEFAULT_MAINNET_PER_LEG_GAS_USD = 5;
export const DEFAULT_PER_LEG_GAS_USD = 0.1;

export const BRIDGE_ARRIVAL_POLL_INTERVAL_MS = 3 * 1000;

export const AUTO_LOCK_REFRESH_INTERVAL_MS = 60 * 1000;

export const FAIL_REASON_I18N_KEY: Record<FailReason, string> = {
  noQuote: 'page.swap.no-quote-found',
  priceImpact: 'page.convertDust.failReason.priceImpactTooHigh',
  gasNotEnough: 'page.convertDust.failReason.gasNotEnough',
  gasTooHigh: 'page.convertDust.failReason.gasCostTooHigh',
  simulationFailed: 'page.signTx.swap.simulationFailed',
  insufficientBalance: 'page.swap.insufficient-balance',
  arrivalFailed: 'global.failed',
  failed: 'global.failed',
};

/** can clear up on a fresh quote; all of them happen before anything is broadcast */
export const AUTO_RETRY_REASONS: readonly FailReason[] = [
  'simulationFailed',
  'noQuote',
  'priceImpact',
];

export const MAX_AUTO_RETRIES = 2;

export const AUTO_RETRY_DELAY_MS = 1500;
