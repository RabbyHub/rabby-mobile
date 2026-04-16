import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';

export type InnerDappPreloadStrategy = 'legacy' | 'screen';

type InnerDappPreloadStrategyState = {
  strategy: InnerDappPreloadStrategy;
};

const defaultState: InnerDappPreloadStrategyState = {
  strategy: 'screen',
};

const innerDappPreloadStrategyStore =
  zustandByMMKV<InnerDappPreloadStrategyState>(
    '@InnerDappPreloadStrategy',
    defaultState,
    { storage: MMKVStorageStrategy.compatJson },
  );

function normalizeStrategy(
  strategy: InnerDappPreloadStrategyState['strategy'],
): InnerDappPreloadStrategy {
  return strategy === 'screen' ? 'screen' : 'legacy';
}

const initialStrategy = innerDappPreloadStrategyStore.getState().strategy;
if (normalizeStrategy(initialStrategy) !== initialStrategy) {
  innerDappPreloadStrategyStore.setState({ strategy: 'screen' });
}

export function useInnerDappPreloadStrategy() {
  return innerDappPreloadStrategyStore(s => normalizeStrategy(s.strategy));
}

export function getInnerDappPreloadStrategy() {
  return normalizeStrategy(innerDappPreloadStrategyStore.getState().strategy);
}

export function setInnerDappPreloadStrategy(
  strategy: InnerDappPreloadStrategy,
) {
  innerDappPreloadStrategyStore.setState({ strategy });
}
