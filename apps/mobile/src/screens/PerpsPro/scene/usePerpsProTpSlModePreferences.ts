import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { perpsServiceApi } from '@/core/serviceApi/perps';
import type {
  PerpsProTpSlModePreferenceSelection,
  PerpsProTpSlModePreferences,
} from '@/core/services/perpsService';

type Listener = () => void;

export type PerpsProTpSlModePreferencesSnapshot =
  PerpsProTpSlModePreferences & {
    hydrated: boolean;
  };

type Dependencies = {
  getPreferences: () => Promise<PerpsProTpSlModePreferences>;
  setPreference: (
    selection: PerpsProTpSlModePreferenceSelection,
  ) => Promise<unknown>;
};

const cloneModes = (
  preferences: PerpsProTpSlModePreferences,
): PerpsProTpSlModePreferences => ({
  opening: { ...preferences.opening },
  position: { ...preferences.position },
});

const DEFAULT_MODES: PerpsProTpSlModePreferences = {
  opening: { sl: 'price', tp: 'price' },
  position: { sl: 'pnl', tp: 'pnl' },
};

const DEFAULT_SNAPSHOT: PerpsProTpSlModePreferencesSnapshot = {
  ...cloneModes(DEFAULT_MODES),
  hydrated: false,
};

const preferenceKey = ({ leg, surface }: PerpsProTpSlModePreferenceSelection) =>
  `${surface}:${leg}` as const;

export const createPerpsProTpSlModePreferencesController = (
  dependencies: Dependencies,
) => {
  let snapshot = DEFAULT_SNAPSHOT;
  let hydratePromise: Promise<void> | null = null;
  const writeGenerations = new Map<string, number>();
  const listeners = new Set<Listener>();
  const publish = (next: PerpsProTpSlModePreferencesSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const hydrate = () => {
    if (snapshot.hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;
    const generationsAtStart = new Map(writeGenerations);
    hydratePromise = dependencies
      .getPreferences()
      .then(preferences => {
        const next = cloneModes(preferences);
        if (
          writeGenerations.get('opening:tp') !==
          generationsAtStart.get('opening:tp')
        ) {
          next.opening.tp = snapshot.opening.tp;
        }
        if (
          writeGenerations.get('opening:sl') !==
          generationsAtStart.get('opening:sl')
        ) {
          next.opening.sl = snapshot.opening.sl;
        }
        if (
          writeGenerations.get('position:tp') !==
          generationsAtStart.get('position:tp')
        ) {
          next.position.tp = snapshot.position.tp;
        }
        if (
          writeGenerations.get('position:sl') !==
          generationsAtStart.get('position:sl')
        ) {
          next.position.sl = snapshot.position.sl;
        }
        publish({ ...next, hydrated: true });
      })
      .catch(error => {
        console.error('[perpsProTpSlModePreferences] hydrate failed', error);
        publish({ ...snapshot, hydrated: true });
      })
      .finally(() => {
        hydratePromise = null;
      });
    return hydratePromise;
  };
  const setMode = (selection: PerpsProTpSlModePreferenceSelection) => {
    const key = preferenceKey(selection);
    const previous = snapshot[selection.surface][selection.leg];
    const generation = (writeGenerations.get(key) ?? 0) + 1;
    writeGenerations.set(key, generation);
    publish({
      ...snapshot,
      [selection.surface]: {
        ...snapshot[selection.surface],
        [selection.leg]: selection.mode,
      },
    });
    return dependencies.setPreference(selection).catch(error => {
      console.error('[perpsProTpSlModePreferences] save failed', error);
      if (writeGenerations.get(key) === generation) {
        publish({
          ...snapshot,
          [selection.surface]: {
            ...snapshot[selection.surface],
            [selection.leg]: previous,
          },
        });
      }
    });
  };
  return {
    getSnapshot: () => snapshot,
    hydrate,
    setMode,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const controller = createPerpsProTpSlModePreferencesController({
  getPreferences: () => perpsServiceApi.getPerpsProTpSlModePreferences(),
  setPreference: selection =>
    perpsServiceApi.setPerpsProTpSlModePreference(selection),
});

export const usePerpsProTpSlModePreferences = () => {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.hydrate();
  }, []);
  return useMemo(
    () => ({ ...snapshot, setMode: controller.setMode }),
    [snapshot],
  );
};
