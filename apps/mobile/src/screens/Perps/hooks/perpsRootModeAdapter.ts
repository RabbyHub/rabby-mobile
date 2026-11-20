import type { PerpsViewMode } from '@/core/services/perpsService';

export type PerpsRootModePreferenceSource = {
  getSnapshot: () => {
    viewMode: PerpsViewMode;
    savingMode: PerpsViewMode | null;
  };
  subscribe: (listener: () => void) => () => void;
  setViewMode: (mode: PerpsViewMode) => Promise<boolean>;
};

export type PerpsRootModeSnapshot = {
  requestedKey: PerpsViewMode;
  settledMode: PerpsViewMode;
};

type RoutePreferenceOwner = {
  isActive: () => boolean;
  discardPending: () => void;
};

// A replacement route may take over queued preferences, but cannot cancel an
// already accepted source write. The source still serializes that write.
const routeOwners = new WeakMap<
  PerpsRootModePreferenceSource,
  RoutePreferenceOwner
>();

/** Route-local navigation, with best-effort preference persistence off its path. */
export function createPerpsRootModeAdapter(
  source: PerpsRootModePreferenceSource,
) {
  // Construction is side-effect free, including React's discarded initializers.
  let active = false;
  let preference = source.getSnapshot();
  let requestedKey = preference.viewMode;
  let settledMode = preference.viewMode;
  let localRevision = 0;
  let pending: PerpsViewMode | null = null;
  let flight: PerpsViewMode | null = null;
  let saveScheduled = false;
  let unsubscribeSource: (() => void) | null = null;
  let externalSaveRevision: number | null = preference.savingMode ? 0 : null;
  const listeners = new Set<() => void>();
  let snapshot: PerpsRootModeSnapshot = { requestedKey, settledMode };
  const owner: RoutePreferenceOwner = {
    isActive: () => active,
    discardPending: () => {
      pending = null;
      releaseSourceWhenIdle();
    },
  };

  function publish() {
    if (
      !active ||
      (snapshot.requestedKey === requestedKey &&
        snapshot.settledMode === settledMode)
    ) {
      return;
    }
    snapshot = { requestedKey, settledMode };
    listeners.forEach(listener => listener());
  }

  function releaseSourceWhenIdle() {
    if (!active && !flight && !pending && !saveScheduled) {
      unsubscribeSource?.();
      unsubscribeSource = null;
      if (routeOwners.get(source) === owner) {
        routeOwners.delete(source);
      }
    }
  }

  function claimOwnership() {
    const previousOwner = routeOwners.get(source);
    if (previousOwner !== owner && !previousOwner?.isActive()) {
      previousOwner?.discardPending();
    }
    routeOwners.set(source, owner);
  }

  function scheduleSave() {
    if (saveScheduled) {
      return;
    }
    saveScheduled = true;
    Promise.resolve().then(() => {
      saveScheduled = false;
      flushSave();
    });
  }

  function readPreference() {
    const next = source.getSnapshot();
    if (
      next.viewMode === preference.viewMode &&
      next.savingMode === preference.savingMode
    ) {
      return;
    }
    if (
      next.savingMode !== null &&
      next.savingMode !== preference.savingMode &&
      next.savingMode !== flight
    ) {
      externalSaveRevision = localRevision;
      // A new consumer's explicit write supersedes this retired route's queue,
      // even if that newer write later fails without changing viewMode.
      if (!active) {
        pending = null;
      }
    }
    if (next.viewMode !== preference.viewMode) {
      // Our completed save is an echo, not a navigation command. An external
      // save may navigate only if no newer local intent superseded its start.
      const externalCanNavigate =
        externalSaveRevision !== null
          ? externalSaveRevision === localRevision
          : !flight && !pending && requestedKey === settledMode;
      if (next.viewMode !== flight && externalCanNavigate) {
        pending = null;
        if (active) {
          requestedKey = next.viewMode;
        }
      }
    }
    preference = next;
    if (next.savingMode === null) {
      externalSaveRevision = null;
    }
    publish();
    scheduleSave();
  }

  function flushSave() {
    readPreference();
    if (flight || preference.savingMode !== null) {
      releaseSourceWhenIdle();
      return;
    }
    const mode = pending;
    pending = null;
    if (mode === null || mode === preference.viewMode) {
      releaseSourceWhenIdle();
      return;
    }
    // Install ownership before invoking the source: its saving notification is
    // synchronous. One slot coalesces later settlements to the latest value.
    flight = mode;
    let result: Promise<boolean>;
    try {
      result = source.setViewMode(mode);
    } catch {
      result = Promise.resolve(false);
    }
    Promise.resolve(result)
      .catch(() => false)
      .then(() => {
        readPreference();
        flight = null;
        // A failed attempt is consumed, never rolled back or auto-retried.
        // A subsequent explicit request/settlement can queue another attempt.
        scheduleSave();
      });
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setActive(value: boolean) {
      active = value;
      if (active) {
        claimOwnership();
        unsubscribeSource ??= source.subscribe(readPreference);
        readPreference();
        publish();
      } else {
        const currentOwner = routeOwners.get(source);
        if (currentOwner && currentOwner !== owner) {
          pending = null;
        }
        // Accepted settlements still drain after unmount, including a pending
        // value waiting for another consumer's save. No UI is published then.
        releaseSourceWhenIdle();
      }
    },
    requestMode(mode: PerpsViewMode) {
      if (!active) {
        return;
      }
      // A retained route can become the caller again without remounting. Only
      // explicit requests claim here; source echoes must not steal ownership.
      claimOwnership();
      localRevision += 1;
      requestedKey = mode;
      if (mode === settledMode) {
        pending = mode;
        scheduleSave();
      }
      publish();
    },
    onSettled(key: string) {
      if (
        !active ||
        (key !== 'simple' && key !== 'pro') ||
        key === settledMode
      ) {
        return;
      }
      localRevision += 1;
      settledMode = key;
      requestedKey = key;
      pending = key;
      publish();
      scheduleSave();
    },
  };
}
