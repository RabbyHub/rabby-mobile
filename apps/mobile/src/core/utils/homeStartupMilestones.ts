import { traceAndroidInstant } from './androidTrace';
import { markStartupRuntimePhase } from '@/startup/runtimeDiagnostics';

type HomeStartupMilestone = 'entryReady' | 'contentReady';

type HomeStartupMilestoneState = {
  reached: boolean;
  reachedAt: number;
  reason: string;
  listeners: Set<() => void>;
};

type RunAfterHomeMilestoneOptions = {
  fallbackMs?: number;
  label?: string;
};

type HomeEntryReadinessState = {
  appUnlocked: boolean;
  isUnlockSessionValid: boolean;
  hasVisibleAccounts: boolean;
};

const milestones: Record<HomeStartupMilestone, HomeStartupMilestoneState> = {
  entryReady: {
    reached: false,
    reachedAt: 0,
    reason: '',
    listeners: new Set(),
  },
  contentReady: {
    reached: false,
    reachedAt: 0,
    reason: '',
    listeners: new Set(),
  },
};

function markHomeMilestone(milestone: HomeStartupMilestone, reason: string) {
  const state = milestones[milestone];
  if (state.reached) {
    traceAndroidInstant('home.milestone_reached_skipped', {
      milestone,
      reason,
      reachedReason: state.reason,
    });
    return false;
  }

  state.reached = true;
  state.reachedAt = Date.now();
  state.reason = reason;
  traceAndroidInstant('home.milestone_reached', {
    milestone,
    reason,
    listenerCount: state.listeners.size,
  });
  markStartupRuntimePhase(
    'home',
    milestone === 'entryReady' ? 'entry-ready' : 'content-ready',
    reason,
  );

  const listeners = Array.from(state.listeners);
  state.listeners.clear();
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error(`[HomeStartupMilestones] ${milestone}`, error);
    }
  });
  return true;
}

function runAfterHomeMilestone(
  milestone: HomeStartupMilestone,
  callback: () => void,
  options: Pick<RunAfterHomeMilestoneOptions, 'label'> = {},
) {
  const state = milestones[milestone];
  if (state.reached) {
    traceAndroidInstant('home.milestone_callback_now', {
      milestone,
      label: options.label,
      reason: state.reason,
    });
    callback();
    return () => undefined;
  }

  let disposed = false;
  const listener = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    traceAndroidInstant('home.milestone_callback_run', {
      milestone,
      label: options.label,
      source: 'milestone',
    });
    callback();
  };

  state.listeners.add(listener);
  traceAndroidInstant('home.milestone_callback_wait', {
    milestone,
    label: options.label,
  });

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    state.listeners.delete(listener);
  };
}

export function markHomeEntryReady(reason: string) {
  return markHomeMilestone('entryReady', reason);
}

export function markHomeEntryReadyIfEligible(
  state: HomeEntryReadinessState,
  reason: string,
) {
  if (
    milestones.entryReady.reached ||
    !state.hasVisibleAccounts ||
    (!state.appUnlocked && !state.isUnlockSessionValid)
  ) {
    return false;
  }

  return markHomeEntryReady(reason);
}

export function markHomeContentReady(reason: string) {
  if (!milestones.entryReady.reached) {
    markHomeEntryReady('home_content_ready_implies_entry');
  }
  return markHomeMilestone('contentReady', reason);
}

export function runAfterHomeEntryReady(
  callback: () => void,
  options?: RunAfterHomeMilestoneOptions,
) {
  return runAfterHomeMilestone('entryReady', callback, options);
}

export function runAfterHomeContentReady(
  callback: () => void,
  options: RunAfterHomeMilestoneOptions = {},
) {
  let disposed = false;
  let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
  let cancelContentWait: () => void = () => undefined;
  let cancelEntryWait: () => void = () => undefined;

  const finish = (source: 'milestone' | 'fallback') => {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelContentWait();
    cancelEntryWait();
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
    }
    if (source === 'fallback') {
      traceAndroidInstant('home.milestone_callback_run', {
        milestone: 'contentReady',
        label: options.label,
        source,
      });
    }
    callback();
  };

  cancelContentWait = runAfterHomeMilestone(
    'contentReady',
    () => finish('milestone'),
    options,
  );

  if (!disposed && typeof options.fallbackMs === 'number') {
    const startFallback = () => {
      if (disposed || fallbackTimeout) {
        return;
      }
      traceAndroidInstant('home.milestone_fallback_start', {
        milestone: 'contentReady',
        label: options.label,
        fallbackMs: options.fallbackMs,
      });
      fallbackTimeout = setTimeout(
        () => finish('fallback'),
        options.fallbackMs,
      );
    };
    cancelEntryWait = runAfterHomeMilestone(
      'entryReady',
      startFallback,
      options,
    );
  }

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelContentWait();
    cancelEntryWait();
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
    }
  };
}

export function getHomeEntryReady() {
  return milestones.entryReady.reached;
}

export function getHomeContentReady() {
  return milestones.contentReady.reached;
}

export function resetHomeStartupMilestonesForTests() {
  Object.values(milestones).forEach(state => {
    state.reached = false;
    state.reachedAt = 0;
    state.reason = '';
    state.listeners.clear();
  });
}
