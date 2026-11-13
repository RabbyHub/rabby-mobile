import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  runOnJS,
  runOnUI,
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
} from 'react-native-reanimated';

import {
  getPullRefreshProbeSnapshot,
  recordPullRefreshProbeUI,
  registerPullRefreshProbeUIFlusher,
  subscribePullRefreshProbe,
  type PullRefreshProbeUIRow,
} from '@/devtools/pullRefreshProbe/controller';
import type {
  PullRefreshProbeInputs,
  PullRefreshProbePhase,
} from './usePullRefreshProbe.prod';

const subscribeNever = () => () => {};
const getInactiveRun = () => null;
const getActiveRun = () => {
  const state = getPullRefreshProbeSnapshot();
  return state.active && !state.pagerEnabled ? state.runId : null;
};

/** Temporary #1130 observer. Never drives a gesture, scroll offset or layout. */
export function usePullRefreshProbe({
  scope,
  loading,
  maxPlaceholderHeight,
  pullDistance,
  scrollViewYValue,
  svIsRefreshing,
  svIsManualRefreshing,
}: PullRefreshProbeInputs) {
  // Only explicitly scoped Home lists subscribe; samples never publish React state.
  const runId = useSyncExternalStore(
    scope ? subscribePullRefreshProbe : subscribeNever,
    scope ? getActiveRun : getInactiveRun,
  );
  const uiSession = useSharedValue({ runId: '', expiresAt: 0 });
  const rows = useSharedValue<PullRefreshProbeUIRow[]>([]);
  const lastSampleAt = useSharedValue(0);
  const lastFlushAt = useSharedValue(0);

  const flushOnUI = useCallback(() => {
    'worklet';
    try {
      const batch = rows.value;
      // Drop this diagnostic batch even if JS scheduling is unavailable. A
      // failed flush must not grow the buffer or interrupt the gesture caller.
      rows.value = [];
      lastFlushAt.value = Date.now();
      if (batch.length && uiSession.value.runId) {
        runOnJS(recordPullRefreshProbeUI)(uiSession.value.runId, batch);
      }
    } catch {
      // The observer is best-effort during runtime teardown.
    }
  }, [lastFlushAt, rows, uiSession]);

  const mark = useCallback(
    (phase: PullRefreshProbePhase, flag?: boolean) => {
      'worklet';
      try {
        const at = Date.now();
        if (
          !scope ||
          !uiSession.value.runId ||
          at >= uiSession.value.expiresAt
        ) {
          return;
        }
        // A bounded batch, not a per-frame JS callback or a React update.
        if (rows.value.length >= 64) {
          flushOnUI();
        }
        rows.value.push({
          at,
          scope,
          phase,
          pull: pullDistance.value,
          scrollY: scrollViewYValue.value,
          refreshing: svIsRefreshing.value,
          manual: svIsManualRefreshing.value,
          // Expected animated height, compared with the native headerFrame.
          // Do not attach another measured View/ref and change Fabric flattening.
          height: Math.max(
            0,
            Math.min(pullDistance.value, maxPlaceholderHeight),
          ),
          ...(phase === 'loading' ? { loading: flag } : {}),
          ...(phase === 'gesture-end' ? { success: flag } : {}),
        });
        if (phase !== 'sample' || at - lastFlushAt.value >= 1000) {
          flushOnUI();
        }
      } catch {
        // A diagnostic read must never change a business gesture's outcome.
      }
    },
    [
      flushOnUI,
      lastFlushAt,
      maxPlaceholderHeight,
      pullDistance,
      rows,
      scope,
      scrollViewYValue,
      svIsManualRefreshing,
      svIsRefreshing,
      uiSession,
    ],
  );

  const onFrame = useCallback(
    (frameInfo: FrameInfo) => {
      'worklet';
      try {
        const at = Date.now();
        if (!uiSession.value.runId || at >= uiSession.value.expiresAt) {
          return;
        }
        // Reanimated also flushes these callbacks for input events. Use them
        // only to throttle geometry sampling, never as display-frame evidence.
        if (frameInfo.timestamp - lastSampleAt.value < 50) {
          return;
        }
        lastSampleAt.value = frameInfo.timestamp;
        mark('sample');
      } catch {
        // SharedValues may already be unavailable during UI teardown.
      }
    },
    [lastSampleAt, mark, uiSession],
  );
  const frame = useFrameCallback(onFrame, false);

  const deactivateFrame = () => {
    try {
      frame.setActive(false);
    } catch {
      // The UI runtime may have stopped before React's effect cleanup.
    }
  };

  useEffect(() => {
    if (!scope) {
      return;
    }
    try {
      const snapshot = getPullRefreshProbeSnapshot();
      runOnUI((nextRun: string, expiresAt: number) => {
        'worklet';
        try {
          flushOnUI();
          uiSession.value = { runId: nextRun, expiresAt };
          lastSampleAt.value = 0;
        } catch {
          // Scheduled work can outlive the diagnostic UI runtime.
        }
      })(runId || '', snapshot.expiresAt);
      frame.setActive(!!runId);
    } catch {
      deactivateFrame();
      return;
    }
    if (!runId) {
      return;
    }

    const unregister = registerPullRefreshProbeUIFlusher(
      (stop = false) =>
        new Promise<void>(resolve => {
          // Bounded if the UI runtime has already been torn down.
          const timeout = setTimeout(resolve, 1000);
          const finished = () => {
            clearTimeout(timeout);
            resolve();
          };
          try {
            if (stop) {
              deactivateFrame();
            }
            runOnUI(() => {
              'worklet';
              mark('sample');
              flushOnUI();
              if (stop) {
                uiSession.value = { runId: '', expiresAt: 0 };
              }
              try {
                runOnJS(finished)();
              } catch {
                // The existing timeout settles an unavailable JS handoff.
              }
            })();
          } catch {
            finished();
          }
        }),
    );
    return () => {
      unregister();
      deactivateFrame();
      try {
        runOnUI(() => {
          'worklet';
          try {
            mark('sample');
            mark('unmount');
            flushOnUI();
            uiSession.value = { runId: '', expiresAt: 0 };
          } catch {
            // Only diagnostic state is abandoned during teardown.
          }
        })();
      } catch {
        // Diagnostic cleanup must not interrupt the component's teardown.
      }
    };
    // All worklets capture stable SharedValues; session changes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, scope]);

  useEffect(() => {
    if (runId) {
      try {
        runOnUI(mark)('loading', loading);
      } catch {
        // Loading observation is optional when the UI runtime is unavailable.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, loading]);

  return {
    listTestID: runId && scope ? `qa1130-${scope}` : undefined,
    mark,
    markFromJS: (phase: PullRefreshProbePhase) => {
      try {
        if (getActiveRun()) {
          runOnUI(mark)(phase);
        }
      } catch {
        // Never prevent request-start or the business request-finish cleanup.
      }
    },
  };
}
