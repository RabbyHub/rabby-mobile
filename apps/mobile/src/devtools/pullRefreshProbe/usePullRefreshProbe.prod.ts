import type { SharedValue } from 'react-native-reanimated';
import type { PullRefreshProbeScope } from './controller.prod';

export type PullRefreshProbeInputs = {
  scope?: PullRefreshProbeScope;
  loading?: boolean;
  maxPlaceholderHeight: number;
  pullDistance: SharedValue<number>;
  scrollViewYValue: SharedValue<number>;
  svIsRefreshing: SharedValue<boolean>;
  svIsManualRefreshing: SharedValue<boolean>;
};

export type PullRefreshProbePhase =
  | 'sample'
  | 'gesture-start'
  | 'gesture-end'
  | 'gesture-finalize'
  | 'request-start'
  | 'request-finish'
  | 'loading'
  | 'unmount';

const noProbe = {
  listTestID: undefined as string | undefined,
  mark: (_phase: PullRefreshProbePhase, _flag?: boolean) => {
    'worklet';
  },
  markFromJS: (_phase: PullRefreshProbePhase) => {},
};

// Babel selects this implementation for public builds: no logger, timers,
// native probe or subscription is reachable from the production hook.
export function usePullRefreshProbe(_inputs: PullRefreshProbeInputs) {
  return noProbe;
}
