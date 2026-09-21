import { perpsServiceApi } from '@/core/serviceApi/perps';
import type {
  PerpsViewMode,
  PerpsViewModePreference,
} from '@/core/services/perpsService';

export type PerpsViewModeSnapshot = Readonly<{
  hydrated: boolean;
  hasVisitedPro: boolean;
  viewMode: PerpsViewMode;
  savingMode: PerpsViewMode | null;
  error: unknown | null;
}>;

type PerpsViewModeDependencies = {
  getPerpsViewModePreference: () => Promise<PerpsViewModePreference>;
  setPerpsViewMode: (viewMode: PerpsViewMode) => Promise<unknown>;
};

type Listener = () => void;

export type PerpsViewModeController = {
  getSnapshot: () => PerpsViewModeSnapshot;
  hydrate: () => Promise<void>;
  setViewMode: (viewMode: PerpsViewMode) => Promise<boolean>;
  subscribe: (listener: Listener) => () => void;
};

const INITIAL_PERPS_VIEW_MODE_SNAPSHOT: PerpsViewModeSnapshot = {
  hydrated: false,
  hasVisitedPro: false,
  viewMode: 'simple',
  savingMode: null,
  error: null,
};

export const createPerpsViewModeController = (
  dependencies: PerpsViewModeDependencies,
): PerpsViewModeController => {
  let snapshot = INITIAL_PERPS_VIEW_MODE_SNAPSHOT;
  let hydratePromise: Promise<void> | null = null;
  let saveFlight: {
    target: PerpsViewMode;
    promise: Promise<boolean>;
  } | null = null;
  const listeners = new Set<Listener>();

  const publish = (nextSnapshot: PerpsViewModeSnapshot) => {
    if (nextSnapshot === snapshot) {
      return;
    }
    snapshot = nextSnapshot;
    listeners.forEach(listener => listener());
  };

  const getSnapshot = () => snapshot;

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const hydrate = (): Promise<void> => {
    if (snapshot.hydrated) {
      return Promise.resolve();
    }
    if (hydratePromise) {
      return hydratePromise;
    }

    const currentPromise = Promise.resolve()
      .then(() => dependencies.getPerpsViewModePreference())
      .then(preference => {
        publish({
          hydrated: true,
          hasVisitedPro: preference.hasVisitedPro === true,
          viewMode: preference.viewMode === 'pro' ? 'pro' : 'simple',
          savingMode: null,
          error: null,
        });
      })
      .catch(error => {
        console.error('[perpsViewMode] hydrate failed', error);
        publish({
          hydrated: true,
          hasVisitedPro: false,
          viewMode: 'simple',
          savingMode: null,
          error,
        });
      })
      .finally(() => {
        if (hydratePromise === currentPromise) {
          hydratePromise = null;
        }
      });
    hydratePromise = currentPromise;
    return currentPromise;
  };

  const setHydratedViewMode = (viewMode: PerpsViewMode): Promise<boolean> => {
    if (saveFlight) {
      return saveFlight.target === viewMode
        ? saveFlight.promise
        : Promise.resolve(false);
    }
    if (snapshot.viewMode === viewMode) {
      return Promise.resolve(true);
    }

    const previousMode = snapshot.viewMode;
    publish({
      ...snapshot,
      savingMode: viewMode,
      error: null,
    });

    const currentPromise = Promise.resolve()
      .then(() => dependencies.setPerpsViewMode(viewMode))
      .then(() => {
        publish({
          hydrated: true,
          hasVisitedPro: snapshot.hasVisitedPro || viewMode === 'pro',
          viewMode,
          savingMode: null,
          error: null,
        });
        return true;
      })
      .catch(error => {
        console.error('[perpsViewMode] save failed', error);
        publish({
          hydrated: true,
          hasVisitedPro: snapshot.hasVisitedPro,
          viewMode: previousMode,
          savingMode: null,
          error,
        });
        return false;
      })
      .finally(() => {
        if (saveFlight?.promise === currentPromise) {
          saveFlight = null;
        }
      });
    saveFlight = {
      target: viewMode,
      promise: currentPromise,
    };
    return currentPromise;
  };

  const setViewMode = (viewMode: PerpsViewMode): Promise<boolean> => {
    if (!snapshot.hydrated) {
      return hydrate().then(() => setHydratedViewMode(viewMode));
    }
    return setHydratedViewMode(viewMode);
  };

  return {
    getSnapshot,
    hydrate,
    setViewMode,
    subscribe,
  };
};

export const perpsViewModeController = createPerpsViewModeController({
  getPerpsViewModePreference: () =>
    perpsServiceApi.getPerpsViewModePreference(),
  setPerpsViewMode: viewMode => perpsServiceApi.setPerpsViewMode(viewMode),
});

export const preparePerpsViewMode =
  async (): Promise<PerpsViewModeSnapshot> => {
    await perpsViewModeController.hydrate();
    return perpsViewModeController.getSnapshot();
  };
