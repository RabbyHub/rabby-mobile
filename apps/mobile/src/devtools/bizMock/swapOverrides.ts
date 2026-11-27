import { isNonPublicProductionEnv } from '@/constant';

/**
 * Non-production-only swap guard overrides for biz-mock suites.
 *
 * The test wallets have no funds, so the local "insufficient balance" guard
 * would stop the real submit handler before it can request a quote and open
 * the signing sheet. The override only bypasses that local guard; it never
 * signs, broadcasts, or changes chain state.
 */
let ignoreInsufficient = false;
let version = 0;
const listeners = new Set<() => void>();

export function setBizMockIgnoreInsufficient(enabled: boolean) {
  if (!isNonPublicProductionEnv) {
    return;
  }
  ignoreInsufficient = enabled === true;
  version += 1;
  listeners.forEach(listener => listener());
}

export function getBizMockIgnoreInsufficient() {
  return isNonPublicProductionEnv && ignoreInsufficient;
}

export function getBizMockSwapOverrideVersion() {
  return version;
}

export function subscribeBizMockSwapOverride(listener: () => void) {
  if (!isNonPublicProductionEnv) {
    return () => undefined;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
