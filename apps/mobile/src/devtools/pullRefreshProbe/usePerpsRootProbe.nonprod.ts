import {
  createElement,
  Profiler,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { runOnJS, runOnUI, useSharedValue } from 'react-native-reanimated';
import type { RootScenePagerProbeEvent } from '@rabby-wallet/rn-collapsible-scene-view/src/rootScenePagerProbe';
import {
  getPullRefreshProbeSnapshot,
  recordPagerProbe,
  registerPullRefreshProbeUIFlusher,
  subscribePullRefreshProbe,
} from '@/devtools/pullRefreshProbe/controller';
import type { PagerProbeRow } from './pagerTypes';
import type {
  PerpsRootProbe,
  PerpsRootProbeProfilerProps,
} from './usePerpsRootProbe.prod';

const ignoreCommit = () => {};

// Keep host identity across arming/disarming: conditional wrapping remounts the
// business page. The public alias has no Profiler; only armed callbacks record.
export function PerpsRootProbeProfiler({
  page,
  onRender,
  children,
}: PerpsRootProbeProfilerProps) {
  return createElement(
    Profiler,
    { id: page, onRender: onRender ?? ignoreCommit },
    children,
  );
}

const CAPACITY = 4096;
const getRun = () => {
  const state = getPullRefreshProbeSnapshot();
  return state.active && state.pagerEnabled ? state.runId : null;
};

/** Boundary events only: no frame callback, console, file I/O or React publication. */
export function usePerpsRootProbe(): PerpsRootProbe {
  const runId = useSyncExternalStore(subscribePullRefreshProbe, getRun);
  const buffer = useSharedValue({
    runId: '',
    expiresAt: 0,
    sequence: 0,
    dropped: 0,
    rows: [] as PagerProbeRow[],
  });
  const onUI = useCallback(
    (event: RootScenePagerProbeEvent) => {
      'worklet';
      try {
        const state = buffer.value;
        const at = Date.now();
        if (!state.runId || at >= state.expiresAt) {
          return;
        }
        if (state.rows.length === CAPACITY) {
          state.rows.shift();
          state.dropped++;
        }
        state.rows.push({
          ...event,
          domain: 'ui',
          at,
          monoMs: performance.now(),
          sequence: ++state.sequence,
          dropped: state.dropped,
        });
      } catch {
        // Observer errors must never escape into a gesture or timing callback.
      }
    },
    [buffer],
  );

  useEffect(() => {
    if (!runId) {
      return;
    }
    const expiresAt = getPullRefreshProbeSnapshot().expiresAt;
    try {
      runOnUI(() => {
        'worklet';
        buffer.value = { runId, expiresAt, sequence: 0, dropped: 0, rows: [] };
      })();
    } catch {
      return;
    }
    const flush = (stop = false) =>
      new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 1000);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        try {
          runOnUI(() => {
            'worklet';
            try {
              const state = buffer.value;
              if (state.runId === runId) {
                const rows = state.rows;
                state.rows = [];
                const at = Date.now();
                if (at <= state.expiresAt) {
                  rows.push({
                    event: 'clock-anchor',
                    domain: 'ui',
                    at,
                    monoMs: performance.now(),
                    sequence: ++state.sequence,
                    dropped: state.dropped,
                  });
                }
                if (stop) {
                  state.runId = '';
                }
                runOnJS(recordPagerProbe)(runId, rows);
              }
            } catch {
              // UI teardown must not raise an application error.
            } finally {
              try {
                runOnJS(done)();
              } catch {
                /* bounded by the JS timer */
              }
            }
          })();
        } catch {
          done();
        }
      });
    const unregister = registerPullRefreshProbeUIFlusher(flush);
    return () => {
      unregister();
      flush(true).catch(() => {});
    };
  }, [buffer, runId]);

  return useMemo<PerpsRootProbe>(() => {
    if (!runId) {
      return {};
    }
    let sequence = 0;
    const record = (
      row: Omit<PagerProbeRow, 'domain' | 'at' | 'monoMs' | 'sequence'>,
    ) => {
      try {
        if (getRun() !== runId) {
          return;
        }
        recordPagerProbe(runId, [
          {
            ...row,
            domain: 'js',
            at: Date.now(),
            monoMs: performance.now(),
            sequence: ++sequence,
          },
        ]);
      } catch {
        // Profiling must not create a business failure.
      }
    };
    return {
      observer: { onUI, onJS: record },
      business: (event, page) => record({ event, page }),
      onRender: (
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      ) => {
        if (id !== 'simple' && id !== 'pro') {
          return;
        }
        record({
          event: 'react-commit',
          page: id,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        });
      },
    };
  }, [onUI, runId]);
}
