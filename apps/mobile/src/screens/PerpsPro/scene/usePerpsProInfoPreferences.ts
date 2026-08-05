import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { perpsServiceApi } from '@/core/serviceApi/perps';
import type { PerpsProInfoTab } from '@/core/services/perpsService';

export interface PerpsProInfoPreferencesSnapshot {
  activeInfoTab: PerpsProInfoTab;
  hydrated: boolean;
}

type Listener = () => void;

interface PerpsProInfoPreferencesDependencies {
  getPerpsProInfoTab: () => Promise<PerpsProInfoTab>;
  setPerpsProInfoTab: (tab: PerpsProInfoTab) => Promise<unknown>;
}

const DEFAULT_SNAPSHOT: PerpsProInfoPreferencesSnapshot = {
  activeInfoTab: 'account',
  hydrated: false,
};

export const createPerpsProInfoPreferencesController = (
  dependencies: PerpsProInfoPreferencesDependencies,
) => {
  let snapshot = DEFAULT_SNAPSHOT;
  let hydratePromise: Promise<void> | null = null;
  let tabWriteGeneration = 0;
  const listeners = new Set<Listener>();

  const publish = (next: PerpsProInfoPreferencesSnapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };

  const hydrate = () => {
    if (snapshot.hydrated) {
      return Promise.resolve();
    }
    if (hydratePromise) {
      return hydratePromise;
    }
    const tabGenerationAtStart = tabWriteGeneration;
    hydratePromise = dependencies
      .getPerpsProInfoTab()
      .then(activeInfoTab => {
        publish({
          activeInfoTab:
            tabWriteGeneration === tabGenerationAtStart
              ? activeInfoTab
              : snapshot.activeInfoTab,
          hydrated: true,
        });
      })
      .catch(error => {
        console.error('[perpsProInfoPreferences] hydrate failed', error);
        publish({
          activeInfoTab:
            tabWriteGeneration === tabGenerationAtStart
              ? DEFAULT_SNAPSHOT.activeInfoTab
              : snapshot.activeInfoTab,
          hydrated: true,
        });
      })
      .finally(() => {
        hydratePromise = null;
      });
    return hydratePromise;
  };

  const setActiveInfoTab = (activeInfoTab: PerpsProInfoTab) => {
    const previous = snapshot.activeInfoTab;
    const generation = ++tabWriteGeneration;
    publish({ ...snapshot, activeInfoTab });
    return dependencies.setPerpsProInfoTab(activeInfoTab).catch(error => {
      console.error('[perpsProInfoPreferences] save tab failed', error);
      if (generation === tabWriteGeneration) {
        publish({ ...snapshot, activeInfoTab: previous });
      }
    });
  };

  return {
    getSnapshot: () => snapshot,
    hydrate,
    setActiveInfoTab,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const controller = createPerpsProInfoPreferencesController({
  getPerpsProInfoTab: () => perpsServiceApi.getPerpsProInfoTab(),
  setPerpsProInfoTab: tab => perpsServiceApi.setPerpsProInfoTab(tab),
});

export const usePerpsProInfoPreferences = () => {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    controller.hydrate();
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      setActiveInfoTab: controller.setActiveInfoTab,
    }),
    [snapshot],
  );
};
