import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useMemoizedFn } from 'ahooks';
import { uiRefreshTimeout } from '@/core/apis/autoLock';
import type { Account } from '@/core/startupServices/preference';
import { zCreate } from '@/core/utils/reexports';
import { useQuoteMethods } from '@/screens/Swap/hooks/quote';
import { useSwapSupportedDexList } from '@/screens/Swap/hooks/settings';
import { AUTO_LOCK_REFRESH_INTERVAL_MS } from '../engine/constants';
import { createProductionLegRunnerDeps } from '../engine/deps';
import {
  createMemeTradeExecutor,
  type MemeTradeExecutor,
} from '../engine/executor';
import { isLegRetryable } from '../engine/displayStatus';
import { createLegRunner } from '../engine/legRunner';
import { createLifecycleController } from '../engine/lifecycle';
import type { ExecLeg, LegState } from '../engine/types';

export type MemeTradeTaskStatus = 'idle' | 'running' | 'finished';

export type MemeTradeTaskState = {
  status: MemeTradeTaskStatus;
  states: Record<string, LegState>;
  exitDialogOpen: boolean;
};

const createTaskStore = (legs: ExecLeg[]) =>
  zCreate<MemeTradeTaskState>(() => ({
    status: 'idle',
    states: Object.fromEntries(legs.map(l => [l.key, { phase: 'idle' }])),
    exitDialogOpen: false,
  }));

export type MemeTradeTaskStore = ReturnType<typeof createTaskStore>;

/** `legs` must already be in execution order; the store is created once per mount. */
export const useMemeTradeTask = ({
  account,
  legs,
  maxPriceImpactPct,
}: {
  account: Account;
  legs: ExecLeg[];
  maxPriceImpactPct: number;
}) => {
  const storeRef = useRef<MemeTradeTaskStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createTaskStore(legs);
  }
  const store = storeRef.current;

  const { getDexQuote } = useQuoteMethods();
  const [supportedDexList] = useSwapSupportedDexList();
  const executorRef = useRef<MemeTradeExecutor | null>(null);

  const lifecycle = useMemo(
    () =>
      createLifecycleController({
        pause: () => executorRef.current?.pause(),
        resume: () => executorRef.current?.resume(),
      }),
    [],
  );

  // Every run gets its own executor and signers; the finished one is done with them.
  const run = useMemoizedFn((runLegs: ExecLeg[]) => {
    const { deps, dispose } = createProductionLegRunnerDeps({
      account,
      getDexQuote,
      supportedDexList,
      maxPriceImpactPct,
    });
    store.setState({ status: 'running' });
    const executor = createMemeTradeExecutor(runLegs, createLegRunner(deps), {
      onLegState: (key, state) =>
        store.setState(prev => ({ states: { ...prev.states, [key]: state } })),
      onFinished: () => {
        store.setState({ status: 'finished' });
        dispose();
      },
    });
    executorRef.current = executor;
    executor.start();
    lifecycle.sync();
  });

  const start = useMemoizedFn(() => {
    if (!executorRef.current) {
      run(legs);
    }
  });

  const retry = useMemoizedFn((keys: string[]) => {
    const { status, states } = store.getState();
    if (status !== 'finished') {
      return;
    }
    const retryLegs = legs.filter(
      leg => keys.includes(leg.key) && isLegRetryable(states[leg.key]),
    );
    if (retryLegs.length) {
      run(retryLegs);
    }
  });

  useEffect(() => {
    lifecycle.setAppActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state =>
      lifecycle.setAppActive(state === 'active'),
    );
    return () => subscription.remove();
  }, [lifecycle]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const apply = (status: MemeTradeTaskStatus) => {
      if (status === 'running' && !timer) {
        timer = setInterval(uiRefreshTimeout, AUTO_LOCK_REFRESH_INTERVAL_MS);
      }
      if (status !== 'running' && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    apply(store.getState().status);
    const unsubscribe = store.subscribe(s => apply(s.status));
    return () => {
      unsubscribe();
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [store]);

  // Only stop here: a leg already inside openDirect finishes broadcasting (spec §5.6);
  // signers are released by onFinished once every leg has settled.
  useEffect(
    () => () => {
      executorRef.current?.stop();
    },
    [],
  );

  const openExitDialog = useMemoizedFn(() => {
    store.setState({ exitDialogOpen: true });
    lifecycle.setExitDialogOpen(true);
  });

  const continueExecution = useMemoizedFn(() => {
    store.setState({ exitDialogOpen: false });
    lifecycle.setExitDialogOpen(false);
  });

  const stopAndExit = useMemoizedFn(() => {
    store.setState({ exitDialogOpen: false });
    executorRef.current?.stop();
  });

  return {
    store,
    start,
    retry,
    openExitDialog,
    continueExecution,
    stopAndExit,
  };
};
