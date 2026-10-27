export const RATE_GUIDE_VERSIONED_KEY = 'lastExposure_20250618_1' as const;

export type RateGuideExposureMetadata = {
  time: number;
  userViewedRate?: boolean;
};

export type RateGuideStateLike = {
  txCount: number;
  latestTxHashes?: string[];
  lastExposure_20250618_1?: RateGuideExposureMetadata;
};

/**
 * Mark the home rate guide as viewed without clearing the transaction history
 * that other home blocks (such as the offline-chain notice) depend on.
 */
export function markRateGuideViewed<T extends RateGuideStateLike>(state: T): T {
  return {
    ...state,
    lastExposure_20250618_1: {
      time: state.lastExposure_20250618_1?.time ?? -1,
      ...state.lastExposure_20250618_1,
      userViewedRate: true,
    },
  };
}
