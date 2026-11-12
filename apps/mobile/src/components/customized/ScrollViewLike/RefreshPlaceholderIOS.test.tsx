import { act, renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import {
  pulldownRefreshSizes,
  usePulldownRefreshGesture,
  usePulldownRefreshStyles,
} from './RefreshPlaceholderIOS';

const mockCallbacks: Record<string, (...args: any[]) => void> = {};
const mockFailOffsetX = jest.fn();
const mockJsRefreshTasks: Promise<void>[] = [];
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
  useAnimatedStyle: (callback: () => object) => callback(),
  interpolate: (
    value: number,
    [inputStart, inputEnd]: number[],
    [outputStart, outputEnd]: number[],
  ) => {
    const progress = Math.min(
      1,
      Math.max(0, (value - inputStart) / (inputEnd - inputStart)),
    );
    return outputStart + progress * (outputEnd - outputStart);
  },
  Extrapolate: { CLAMP: 'clamp' },
  withTiming: (value: unknown) => value,
  runOnJS:
    (fn: (...args: any[]) => unknown) =>
    (...args: any[]) => {
      const task = fn(...args);
      if (task instanceof Promise) {
        mockJsRefreshTasks.push(task);
      }
      return task;
    },
  Easing: { inOut: (fn: unknown) => fn, quad: (x: number) => x },
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const gesture: Record<string, any> = {};
      for (const name of [
        'shouldCancelWhenOutside',
        'activeOffsetY',
        'maxPointers',
        'onStart',
        'onUpdate',
        'onEnd',
        'onFinalize',
        'failOffsetX',
      ]) {
        gesture[name] = (value: any) => {
          if (name.startsWith('on')) mockCallbacks[name] = value;
          if (name === 'failOffsetX') mockFailOffsetX(value);
          return gesture;
        };
      }
      return gesture;
    },
  },
}));
jest.mock('../reexports', () => ({}));
jest.mock('@/hooks/theme', () => ({}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/hooks/reanimated', () => ({
  useValueFromSharedValue: (sv: { value: unknown }) => sv.value,
}));
jest.mock('@/utils/common', () => ({ triggerImpact: jest.fn() }));
jest.mock('@/constant/home', () => ({
  HOME_TOP_HEADER_SIZES: {
    scrollableListTopOffset: 48,
    tabInnerHomeTopOffset: 72,
    headerOffsetAfterTabItem: 12,
  },
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING: true,
}));

beforeEach(() => {
  mockJsRefreshTasks.length = 0;
});

it('returns a cancelled pull to zero and leaves horizontal intent to the pager', () => {
  const onRefresh = jest.fn(async () => undefined);
  const { result } = renderHook(() =>
    usePulldownRefreshGesture({
      scrollViewYValue: { value: 0 } as any,
      onJsPulldownRefresh: onRefresh,
    }),
  );
  act(() => {
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({ translationY: 80 });
  });
  expect(result.current.svs.pullDistance.value).toBe(80);
  act(() => mockCallbacks.onFinalize());
  expect(result.current.svs.pullDistance.value).toBe(0);
  expect(onRefresh).not.toHaveBeenCalled();
  expect(mockFailOffsetX).toHaveBeenCalledWith([-24, 24]);
});

it('preserves a pending refresh on finalize, then finishes without a loading-state effect', async () => {
  let finishRefresh!: () => void;
  const refresh = new Promise<void>(resolve => {
    finishRefresh = resolve;
  });
  const { result } = renderHook(() =>
    usePulldownRefreshGesture({
      scrollViewYValue: { value: 0 } as any,
      onJsPulldownRefresh: ({ svIsManualRefreshing }) => {
        svIsManualRefreshing.value = true;
        return refresh;
      },
    }),
  );
  act(() => {
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({ translationY: 300 });
    mockCallbacks.onEnd({}, true);
    mockCallbacks.onFinalize();
  });
  expect(result.current.svs.svIsRefreshing.value).toBe(true);
  expect(result.current.svs.svIsManualRefreshing.value).toBe(true);
  expect(result.current.svs.pullDistance.value).toBe(
    pulldownRefreshSizes.homeHeaderHeight,
  );
  await act(async () => {
    finishRefresh();
    await mockJsRefreshTasks[0];
  });
  expect(result.current.svs.svIsRefreshing.value).toBe(false);
  expect(result.current.svs.svIsManualRefreshing.value).toBe(false);
  expect(result.current.svs.pullDistance.value).toBe(0);
});

it('releases the placeholder when refresh rejects without swallowing the error', async () => {
  let failRefresh!: (error: Error) => void;
  const refresh = new Promise<void>((_, reject) => {
    failRefresh = reject;
  });
  const { result } = renderHook(() =>
    usePulldownRefreshGesture({
      scrollViewYValue: { value: 0 } as any,
      onJsPulldownRefresh: ({ svIsManualRefreshing }) => {
        svIsManualRefreshing.value = true;
        return refresh;
      },
    }),
  );
  act(() => {
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({ translationY: 300 });
    mockCallbacks.onEnd({}, true);
  });
  const error = new Error('Refresh failed');
  await act(async () => {
    failRefresh(error);
    await expect(mockJsRefreshTasks[0]).rejects.toBe(error);
  });
  expect(result.current.svs.svIsRefreshing.value).toBe(false);
  expect(result.current.svs.svIsManualRefreshing.value).toBe(false);
  expect(result.current.svs.pullDistance.value).toBe(0);
});

it('does not refresh when an active pull is cancelled after crossing the threshold', () => {
  const onRefresh = jest.fn(async () => undefined);
  const { result } = renderHook(() =>
    usePulldownRefreshGesture({
      scrollViewYValue: { value: 0 } as any,
      onJsPulldownRefresh: onRefresh,
    }),
  );

  act(() => {
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({ translationY: 300 });
    // RNGH reports an active gesture cancellation to onEnd before finalize.
    mockCallbacks.onEnd({}, false);
    mockCallbacks.onFinalize({}, false);
  });

  expect(onRefresh).not.toHaveBeenCalled();
  expect(result.current.svs.svIsRefreshing.value).toBe(false);
  expect(result.current.svs.pullDistance.value).toBe(0);
});

it('allows overpull, then settles to the indicator height until refresh finishes', async () => {
  const indicatorHeight = pulldownRefreshSizes.homeHeaderHeight;
  const maxPullHeight =
    Dimensions.get('screen').height * 0.5 -
    HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset;
  let finishRefresh!: () => void;
  const refresh = new Promise<void>(resolve => {
    finishRefresh = resolve;
  });
  const onRefresh = jest.fn(() => refresh);
  const scrollY = { value: 0 } as any;
  const { result, rerender } = renderHook(() => {
    const gesture = usePulldownRefreshGesture({
      scrollViewYValue: scrollY,
      onJsPulldownRefresh: onRefresh,
    });
    const styles = usePulldownRefreshStyles({
      states: gesture.svs,
      indicatorSpaceHeight: indicatorHeight,
    });
    return { ...gesture, styles };
  });

  expect(result.current.styles.scrollTopStyle.height).toBe(0);
  act(() => {
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({ translationY: 300 });
  });
  rerender({});
  expect(result.current.svs.pullDistance.value).toBe(300);
  expect(result.current.styles.scrollTopStyle.height).toBe(
    Math.min(300, maxPullHeight),
  );
  expect(result.current.styles.scrollTopStyle.height).toBeGreaterThan(
    indicatorHeight,
  );
  expect(onRefresh).not.toHaveBeenCalled();

  act(() => mockCallbacks.onUpdate({ translationY: 10000 }));
  rerender({});
  expect(result.current.styles.scrollTopStyle.height).toBe(maxPullHeight);

  // Moving the finger back must reduce the space before release, too.
  act(() => mockCallbacks.onUpdate({ translationY: 150 }));
  rerender({});
  expect(result.current.styles.scrollTopStyle.height).toBe(
    Math.min(150, maxPullHeight),
  );
  expect(onRefresh).not.toHaveBeenCalled();

  act(() => {
    mockCallbacks.onEnd({}, true);
    mockCallbacks.onFinalize();
    // Further touches cannot expand the spacer or restart an in-flight refresh.
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({ translationY: 500 });
    mockCallbacks.onEnd({}, true);
    mockCallbacks.onFinalize();
  });
  rerender({});
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(result.current.svs.svIsRefreshing.value).toBe(true);
  expect(result.current.styles.scrollTopStyle.height).toBe(indicatorHeight);

  await act(async () => {
    finishRefresh();
    await mockJsRefreshTasks[0];
  });
  rerender({});
  expect(result.current.svs.svIsRefreshing.value).toBe(false);
  expect(result.current.styles.scrollTopStyle.height).toBe(0);
});

it('returns a below-threshold overpull to zero without starting a request', () => {
  const onRefresh = jest.fn(async () => undefined);
  const { result, rerender } = renderHook(() => {
    const gesture = usePulldownRefreshGesture({
      scrollViewYValue: { value: 0 } as any,
      onJsPulldownRefresh: onRefresh,
    });
    const styles = usePulldownRefreshStyles({
      states: gesture.svs,
      indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    });
    return { ...gesture, styles };
  });

  act(() => {
    mockCallbacks.onStart({});
    mockCallbacks.onUpdate({
      translationY: pulldownRefreshSizes.homeHeaderHeight + 1,
    });
  });
  rerender({});
  expect(result.current.styles.scrollTopStyle.height).toBeGreaterThan(
    pulldownRefreshSizes.homeHeaderHeight,
  );
  act(() => {
    mockCallbacks.onEnd({}, true);
    mockCallbacks.onFinalize();
  });
  rerender({});
  expect(onRefresh).not.toHaveBeenCalled();
  expect(result.current.styles.scrollTopStyle.height).toBe(0);
});
