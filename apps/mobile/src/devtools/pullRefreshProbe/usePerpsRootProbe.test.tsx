import React, { useEffect } from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import { View } from 'react-native';
import type { PullRefreshProbeSnapshot } from './controller.prod';
import {
  usePerpsRootProbe,
  PerpsRootProbeProfiler,
} from './usePerpsRootProbe.nonprod';
import { usePerpsRootProbe as usePublicProbe } from './usePerpsRootProbe.prod';

// Unit contracts only: worklets execute synchronously in this test boundary.
// This proves buffering/gates, not UI scheduling, actual frame timing or FPS.
let mockState: PullRefreshProbeSnapshot;
let mockListener: (() => void) | undefined;
let mockFlusher: ((stop?: boolean) => Promise<void>) | undefined;
const mockRecord = jest.fn();
const mockBridge = jest.fn();
jest.mock('@/devtools/pullRefreshProbe/controller', () => ({
  getPullRefreshProbeSnapshot: () => mockState,
  subscribePullRefreshProbe: (listener: () => void) => {
    mockListener = listener;
    return () => {
      mockListener = undefined;
    };
  },
  registerPullRefreshProbeUIFlusher: (
    flush: (stop?: boolean) => Promise<void>,
  ) => {
    mockFlusher = flush;
    return () => {
      mockFlusher = undefined;
    };
  },
  recordPagerProbe: (...args: unknown[]) => mockRecord(...args),
}));
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) =>
    require('react').useRef({ value }).current,
  runOnUI: (fn: (...args: unknown[]) => unknown) => fn,
  runOnJS:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      mockBridge();
      return fn(...args);
    },
}));

beforeEach(() => {
  mockRecord.mockClear();
  mockBridge.mockClear();
  mockState = {
    active: true,
    pagerEnabled: true,
    runId: 'pager-unit',
    expiresAt: Date.now() + 60000,
  };
});

it('buffers UI events without bridging until an explicit flush and stops afterward', async () => {
  const { result } = renderHook(usePerpsRootProbe);
  const mark = result.current.observer!.onUI;
  for (let epoch = 0; epoch < 10; epoch++) {
    mark({ event: 'release', epoch, command: 0 });
  }
  expect(mockBridge).not.toHaveBeenCalled();
  expect(mockRecord).not.toHaveBeenCalled();
  await act(async () => {
    await mockFlusher?.(true);
  });
  const rows = mockRecord.mock.calls.flatMap(([, batch]) => batch);
  expect(rows.filter(row => row.event === 'release')).toHaveLength(10);
  expect(
    rows.every(row => row.domain === 'ui' && Number.isFinite(row.monoMs)),
  ).toBe(true);
  mockRecord.mockClear();
  mark({ event: 'release', epoch: 11, command: 0 });
  await act(async () => {
    await mockFlusher?.();
  });
  expect(mockRecord).not.toHaveBeenCalled();
});

it('excludes Home-only/public sessions and disarms stale JS callbacks', () => {
  mockState.pagerEnabled = false;
  const { result } = renderHook(usePerpsRootProbe);
  expect(result.current.observer).toBeUndefined();
  expect(usePublicProbe().observer).toBeUndefined();
  act(() => {
    mockState = { ...mockState, pagerEnabled: true };
    mockListener?.();
  });
  const stale = result.current.business;
  act(() => {
    mockState = { active: false, runId: null, expiresAt: 0 };
    mockListener?.();
  });
  mockRecord.mockClear();
  stale?.('business-begin', 'pro');
  expect(mockRecord).not.toHaveBeenCalled();
});

it('does not remount page children when profiling is armed or disarmed', () => {
  const mount = jest.fn();
  function Child() {
    useEffect(mount, []);
    return <View />;
  }
  const child = <Child />;
  const { rerender } = render(
    <PerpsRootProbeProfiler page="pro">{child}</PerpsRootProbeProfiler>,
  );
  rerender(
    <PerpsRootProbeProfiler page="pro" onRender={jest.fn()}>
      {child}
    </PerpsRootProbeProfiler>,
  );
  rerender(<PerpsRootProbeProfiler page="pro">{child}</PerpsRootProbeProfiler>);
  expect(mount).toHaveBeenCalledTimes(1);
});
