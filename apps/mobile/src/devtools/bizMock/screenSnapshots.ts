import { isNonPublicProductionEnv } from '@/constant';

/**
 * Non-production screen snapshots for biz-mock `state.dump`.
 *
 * Screens can publish a small, safe projection of their business state (token
 * ids, amount, quote readiness, provider) so host suites can assert
 * "dispatched" state instead of only looking at the route.
 *
 * Production never registers a contributor and never reads this module.
 */
const snapshots = new Map<string, unknown>();

export function setBizMockScreenSnapshot(key: string, value: unknown) {
  if (!isNonPublicProductionEnv) {
    return;
  }
  snapshots.set(key, value);
}

export function clearBizMockScreenSnapshot(key: string) {
  if (!isNonPublicProductionEnv) {
    return;
  }
  snapshots.delete(key);
}

export function getBizMockScreenSnapshots() {
  if (!isNonPublicProductionEnv) {
    return {};
  }
  return Object.fromEntries(snapshots.entries());
}
