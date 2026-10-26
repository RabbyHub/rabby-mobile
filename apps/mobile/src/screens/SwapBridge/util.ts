import BigNumber from 'bignumber.js';
import { CHAINS_ENUM } from '@debank/common';
import { findChainByServerID } from '@/utils/chain';

export function readRegressionUsdParam(
  value: string | undefined,
  fallback: string,
) {
  const parsed = new BigNumber(value || fallback);
  return parsed.isFinite() && parsed.gt(0) ? parsed : new BigNumber(fallback);
}

export function readRegressionSwapChain(value: string | undefined) {
  const normalized = (value || 'polygon').toLowerCase();
  if (normalized === 'polygon' || normalized === 'matic') {
    return CHAINS_ENUM.POLYGON;
  }
  return findChainByServerID(normalized)?.enum || CHAINS_ENUM.POLYGON;
}

export function formatSafeHash(hash?: string) {
  if (!hash) {
    return '';
  }
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function isRegressionBroadcastRequested(
  params: Readonly<Record<string, string>>,
) {
  const value = params.broadcast;
  return !!value && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function isSameAmountValue(
  current: string | undefined,
  target: BigNumber,
) {
  const parsed = new BigNumber(current || 0);
  return parsed.isFinite() && parsed.eq(target);
}
