import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';

export const MAX_RETAINED_WEBVIEWS_OPTIONS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
] as const;
export type MaxRetainedWebviews =
  (typeof MAX_RETAINED_WEBVIEWS_OPTIONS)[number];

type InnerDappPreloadRetentionState = {
  maxRetainedWebviews: number;
};

const defaultState: InnerDappPreloadRetentionState = {
  maxRetainedWebviews: 1,
};

const innerDappPreloadRetentionStore =
  zustandByMMKV<InnerDappPreloadRetentionState>(
    '@InnerDappPreloadRetention',
    defaultState,
    { storage: MMKVStorageStrategy.compatJson },
  );

function normalizeMaxRetainedWebviews(value: number): MaxRetainedWebviews {
  const numeric = Number.isFinite(value)
    ? Math.floor(value)
    : defaultState.maxRetainedWebviews;
  if (numeric <= 1) {
    return 1;
  }
  if (numeric >= 9) {
    return 9;
  }
  return numeric as MaxRetainedWebviews;
}

const initialValue =
  innerDappPreloadRetentionStore.getState().maxRetainedWebviews;
if (normalizeMaxRetainedWebviews(initialValue) !== initialValue) {
  innerDappPreloadRetentionStore.setState({
    maxRetainedWebviews: defaultState.maxRetainedWebviews,
  });
}

export function useInnerDappPreloadRetention() {
  return innerDappPreloadRetentionStore(s =>
    normalizeMaxRetainedWebviews(s.maxRetainedWebviews),
  );
}

export function getInnerDappPreloadRetention() {
  return normalizeMaxRetainedWebviews(
    innerDappPreloadRetentionStore.getState().maxRetainedWebviews,
  );
}

export function setInnerDappPreloadRetention(value: number) {
  innerDappPreloadRetentionStore.setState({
    maxRetainedWebviews: normalizeMaxRetainedWebviews(value),
  });
}

export { normalizeMaxRetainedWebviews };
