import BigNumber from 'bignumber.js';

import { isNonPublicProductionEnv } from '@/constant';

/**
 * Non-production token-balance overrides for biz-mock suites.
 *
 * Test wallets hold no funds. Instead of disabling the product's
 * insufficient-balance guard, this overrides the token's raw balance that the
 * guard reads, the same way a store pin would. Nothing is signed or
 * broadcast, and the suites clear the override when they finish.
 */

type BalanceOverride = {
  rawAmountHex: string;
  amount: number;
};

const overrides = new Map<string, BalanceOverride>();
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  listeners.forEach(listener => listener());
}

export function setBizMockTokenBalance(
  tokenId: string | undefined,
  amount: string | number,
  decimals: number,
) {
  if (!isNonPublicProductionEnv || !tokenId) {
    return;
  }
  const parsed = new BigNumber(amount);
  if (!parsed.isFinite() || parsed.lte(0)) {
    return;
  }
  const scaled = parsed.times(10 ** decimals).toFixed(0);
  overrides.set(tokenId.toLowerCase(), {
    rawAmountHex: `0x${BigInt(scaled).toString(16)}`,
    amount: parsed.toNumber(),
  });
  notify();
}

export function clearBizMockTokenBalances() {
  if (!isNonPublicProductionEnv) {
    return;
  }
  overrides.clear();
  notify();
}

export function applyBizMockTokenBalance<
  T extends { id?: string; raw_amount_hex_str?: string; amount?: number },
>(token: T | undefined): T | undefined {
  if (!isNonPublicProductionEnv || !token?.id) {
    return token;
  }
  const override = overrides.get(token.id.toLowerCase());
  if (!override) {
    return token;
  }
  return {
    ...token,
    raw_amount_hex_str: override.rawAmountHex,
    amount: override.amount,
  };
}

export function getBizMockTokenBalanceVersion() {
  return version;
}

export function subscribeBizMockTokenBalance(listener: () => void) {
  if (!isNonPublicProductionEnv) {
    return () => undefined;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
