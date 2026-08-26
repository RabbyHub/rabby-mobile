import type { TokenAssetSyncReceipt } from './protocol';

export type TokenAssetSyncRetryPlan = {
  address: string;
  /** Null means the main runtime must resolve the complete used-chain list. */
  chainIds: string[] | null;
};

/** Plan the minimum safe main-runtime fallback after a Worker token sync. */
export function buildTokenAssetSyncRetryPlan(
  addresses: string[],
  receipt?: TokenAssetSyncReceipt | null,
): TokenAssetSyncRetryPlan[] {
  const completions = new Map(
    (receipt?.addresses || []).map(completion => [
      completion.address.toLowerCase(),
      completion,
    ]),
  );

  const normalizedAddresses = Array.from(
    new Set(addresses.map(address => address.toLowerCase()).filter(Boolean)),
  );
  const retryPlan: TokenAssetSyncRetryPlan[] = [];
  normalizedAddresses.forEach(address => {
    const completion = completions.get(address);
    if (
      completion?.success &&
      completion.outcome === 'complete' &&
      !completion.superseded
    ) {
      return;
    }
    if (
      completion?.success &&
      completion.outcome === 'partial' &&
      !completion.superseded
    ) {
      retryPlan.push({ address, chainIds: completion.failedChainIds });
      return;
    }
    retryPlan.push({ address, chainIds: null });
  });
  return retryPlan;
}
