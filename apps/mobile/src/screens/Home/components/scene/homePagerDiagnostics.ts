import type { SharedValue } from 'react-native-reanimated';

import { isNonPublicProductionEnv } from '@/constant';
import { zustandByMMKV } from '@/core/storage/mmkv';

/**
 * Bounded, non-production diagnostics for the Home first-floor pager.
 *
 * The pager only knows how to report discrete gesture/settle transitions; this
 * module owns the ring buffer, counters and subscriptions so the floating
 * panel stays a pure consumer. Every entry point is a no-op outside
 * non-production builds.
 */

export type HomePagerDebugEvent = {
  id: number;
  at: number;
  kind: string;
  text: string;
};

export type HomePagerDebugCounters = {
  settles: number;
  commits: number;
  skipped: number;
  ignoredJumps: number;
  backwards: number;
};

export type HomePagerDebugSnapshot = {
  events: readonly HomePagerDebugEvent[];
  counters: HomePagerDebugCounters;
  lastCommit: number;
};

type LiveRefs = {
  track?: SharedValue<number>;
  gesturing?: SharedValue<boolean>;
};

const MAX_EVENTS = 28;

let nextEventId = 1;
let events: HomePagerDebugEvent[] = [];
let counters: HomePagerDebugCounters = {
  settles: 0,
  commits: 0,
  skipped: 0,
  ignoredJumps: 0,
  backwards: 0,
};
let lastCommit = -1;
let liveRefs: LiveRefs = {};
const listeners = new Set<() => void>();

export const homePagerDebugPanelStore = zustandByMMKV<{ enabled: boolean }>(
  '@HomePagerDebugPanel',
  { enabled: false },
);

export function setHomePagerDebugPanelEnabled(next?: boolean) {
  if (!isNonPublicProductionEnv) {
    return false;
  }
  let final = false;
  homePagerDebugPanelStore.setState(prev => {
    final = typeof next === 'boolean' ? next : !prev.enabled;
    return { ...prev, enabled: final };
  });
  return final;
}

export function useToggleHomePagerDebugPanel() {
  const enabled = homePagerDebugPanelStore(
    state => isNonPublicProductionEnv && state.enabled,
  );
  return {
    showHomePagerDebugPanel: enabled,
    toggleHomePagerDebugPanel: setHomePagerDebugPanelEnabled,
  };
}

function notify() {
  listeners.forEach(listener => listener());
}

export function recordHomePagerDebugEvent(
  kind: HomePagerDebugEvent['kind'],
  text: string,
) {
  if (!isNonPublicProductionEnv) {
    return;
  }
  events = [{ id: nextEventId++, at: Date.now(), kind, text }, ...events].slice(
    0,
    MAX_EVENTS,
  );
  if (kind === 'settle') {
    counters = { ...counters, settles: counters.settles + 1 };
  } else if (kind === 'commit') {
    counters = { ...counters, commits: counters.commits + 1 };
  } else if (kind === 'jump-ignored') {
    counters = { ...counters, ignoredJumps: counters.ignoredJumps + 1 };
  }
  notify();
}

/**
 * Records the page a commit landed on and flags target anomalies: skipping a
 * page (one gesture should never move more than one page) or moving back.
 */
export function recordHomePagerCommittedPage(page: number) {
  if (!isNonPublicProductionEnv) {
    return;
  }
  if (lastCommit >= 0) {
    const delta = page - lastCommit;
    if (Math.abs(delta) > 1) {
      counters = { ...counters, skipped: counters.skipped + 1 };
    } else if (delta < 0) {
      counters = { ...counters, backwards: counters.backwards + 1 };
    }
  }
  lastCommit = page;
}

export function bindHomePagerDebugLive(refs: LiveRefs) {
  liveRefs = refs;
  return () => {
    if (liveRefs === refs) {
      liveRefs = {};
    }
  };
}

export function readHomePagerDebugLive() {
  return {
    track: liveRefs.track?.value ?? Number.NaN,
    gesturing: liveRefs.gesturing?.value === true,
  };
}

export function getHomePagerDebugSnapshot(): HomePagerDebugSnapshot {
  return { events, counters, lastCommit };
}

export function subscribeHomePagerDebug(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetHomePagerDebug() {
  if (!isNonPublicProductionEnv) {
    return;
  }
  events = [];
  counters = {
    settles: 0,
    commits: 0,
    skipped: 0,
    ignoredJumps: 0,
    backwards: 0,
  };
  lastCommit = -1;
  notify();
}
