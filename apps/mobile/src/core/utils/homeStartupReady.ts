import { InteractionManager, Platform } from 'react-native';

import { zCreate, zMutative } from '@/core/utils/reexports';
import { logger } from '@/utils/logger';

const HOME_CRITICAL_READY_DELAY_MS = 32;
const HOME_POST_STARTUP_DEFER_MS = 450;
const isAndroid = Platform.OS === 'android';

type HomeStartupReadyState = {
  ready: boolean;
  readyAt: number;
  postReady: boolean;
  postReadyAt: number;
  generation: number;
};

const homeStartupReadyStore = zCreate(
  zMutative<HomeStartupReadyState>(
    () => ({
      ready: false,
      readyAt: 0,
      postReady: false,
      postReadyAt: 0,
      generation: 0,
    }),
    {
      strict: __DEV__,
    },
  ),
);

function traceHomeStartup(event: string, data: Record<string, unknown> = {}) {
  if (!isAndroid) {
    return;
  }

  logger.info(`[RabbyUnlockPerf:home] ${event}`, data);
}

export function useHomeStartupReady() {
  return homeStartupReadyStore(state => state.ready);
}

export function useHomePostStartupReady() {
  return homeStartupReadyStore(state => state.postReady);
}

export function getHomeStartupReady() {
  return homeStartupReadyStore.getState().ready;
}

export function getHomePostStartupReady() {
  return homeStartupReadyStore.getState().postReady;
}

export function resetHomeStartupReady() {
  homeStartupReadyStore.setState(state => {
    state.ready = false;
    state.readyAt = 0;
    state.postReady = false;
    state.postReadyAt = 0;
    state.generation += 1;
  });
}

function markHomeStartupReady(
  scheduledGeneration: number,
  isDisposed: () => boolean,
) {
  const current = homeStartupReadyStore.getState();
  if (
    isDisposed() ||
    current.ready ||
    current.generation !== scheduledGeneration
  ) {
    return;
  }

  traceHomeStartup('home_startup_ready');
  homeStartupReadyStore.setState(state => {
    state.ready = true;
    state.readyAt = Date.now();
  });
}

function markHomePostStartupReady(
  scheduledGeneration: number,
  isDisposed: () => boolean,
) {
  const current = homeStartupReadyStore.getState();
  if (
    isDisposed() ||
    current.postReady ||
    current.generation !== scheduledGeneration
  ) {
    return;
  }

  traceHomeStartup('home_post_startup_ready');
  homeStartupReadyStore.setState(state => {
    state.postReady = true;
    state.postReadyAt = Date.now();
  });
}

export function scheduleHomeStartupReady() {
  const scheduledGeneration = homeStartupReadyStore.getState().generation;
  let disposed = false;
  let criticalTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let postTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let frameId: number | null = null;
  let secondFrameId: number | null = null;

  traceHomeStartup('home_startup_defer_start', {
    delayMs: HOME_CRITICAL_READY_DELAY_MS,
  });

  frameId = requestAnimationFrame(() => {
    secondFrameId = requestAnimationFrame(() => {
      criticalTimeoutId = setTimeout(() => {
        markHomeStartupReady(scheduledGeneration, () => disposed);
      }, HOME_CRITICAL_READY_DELAY_MS);
    });
  });

  traceHomeStartup('home_post_startup_defer_start', {
    delayMs: HOME_POST_STARTUP_DEFER_MS,
  });

  const interactionHandle = InteractionManager.runAfterInteractions(() => {
    postTimeoutId = setTimeout(() => {
      markHomePostStartupReady(scheduledGeneration, () => disposed);
    }, HOME_POST_STARTUP_DEFER_MS);
  });

  return () => {
    disposed = true;
    interactionHandle.cancel?.();
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    if (secondFrameId !== null) {
      cancelAnimationFrame(secondFrameId);
    }
    if (criticalTimeoutId) {
      clearTimeout(criticalTimeoutId);
    }
    if (postTimeoutId) {
      clearTimeout(postTimeoutId);
    }
  };
}

export function traceHomeStartupReady(
  event: string,
  data: Record<string, unknown> = {},
) {
  traceHomeStartup(event, data);
}
