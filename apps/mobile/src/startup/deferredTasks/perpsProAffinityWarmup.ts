import { perpsServiceApi } from '@/core/serviceApi/perps';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { AppState, type AppStateStatus } from 'react-native';

type PerpsProAffinityWarmupDependencies = {
  getAppState: () => AppStateStatus;
  getViewMode: () => Promise<PerpsViewMode>;
  loadWarmupOwner: () => Promise<{
    prewarmPerpsProHomeAffinity: () => Promise<boolean>;
  }>;
};

type PerpsProHomeNavigationIntentDependencies = {
  getViewMode: () => Promise<PerpsViewMode>;
  loadWarmupOwner: () => Promise<{
    prewarmPerpsProHomeNavigationIntent: () => Promise<boolean>;
  }>;
};

const defaultDependencies: PerpsProAffinityWarmupDependencies = {
  getAppState: () => AppState.currentState,
  getViewMode: () => perpsServiceApi.getPerpsViewMode(),
  loadWarmupOwner: () => import('@/screens/PerpsPro/scene/perpsProHomeWarmup'),
};

const defaultNavigationIntentDependencies: PerpsProHomeNavigationIntentDependencies =
  {
    getViewMode: () => perpsServiceApi.getPerpsViewMode(),
    loadWarmupOwner: () =>
      import('@/screens/PerpsPro/scene/perpsProHomeWarmup'),
  };

export const runPerpsProAffinityWarmup = async (
  dependencies: PerpsProAffinityWarmupDependencies = defaultDependencies,
) => {
  if (dependencies.getAppState() !== 'active') {
    return false;
  }

  let viewMode: PerpsViewMode;
  try {
    viewMode = await dependencies.getViewMode();
  } catch (error) {
    console.error('[perpsProAffinityWarmup] read view mode failed', error);
    return false;
  }

  if (viewMode !== 'pro' || dependencies.getAppState() !== 'active') {
    return false;
  }

  const { prewarmPerpsProHomeAffinity } = await dependencies.loadWarmupOwner();
  if (dependencies.getAppState() !== 'active') {
    return false;
  }
  return prewarmPerpsProHomeAffinity();
};

let warmupFlight: Promise<boolean> | null = null;

export const startPerpsProAffinityWarmup = () => {
  if (warmupFlight) {
    return warmupFlight;
  }
  const flight = runPerpsProAffinityWarmup().finally(() => {
    if (warmupFlight === flight) {
      warmupFlight = null;
    }
  });
  warmupFlight = flight;
  return flight;
};

/**
 * Keeps the persisted-mode gate outside the Pro owner module so a Simple user
 * can navigate immediately without loading FastL2/trades intent code.
 */
export const startPerpsProHomeNavigationIntent = async (
  dependencies: PerpsProHomeNavigationIntentDependencies = defaultNavigationIntentDependencies,
) => {
  let viewMode: PerpsViewMode;
  try {
    viewMode = await dependencies.getViewMode();
  } catch (error) {
    console.error('[perpsProHomeIntent] read view mode failed', error);
    return false;
  }
  if (viewMode !== 'pro') {
    return false;
  }

  const { prewarmPerpsProHomeNavigationIntent } =
    await dependencies.loadWarmupOwner();
  return prewarmPerpsProHomeNavigationIntent();
};
