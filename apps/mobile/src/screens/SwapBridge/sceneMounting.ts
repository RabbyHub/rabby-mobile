import type { SwapBridgeTab } from '@/navigation-type';

export type MountedSwapBridgeScenes = Record<SwapBridgeTab, boolean>;

export function createInitialMountedSwapBridgeScenes(
  initialTab: SwapBridgeTab,
): MountedSwapBridgeScenes {
  return {
    swap: initialTab === 'swap',
    bridge: initialTab === 'bridge',
  };
}

export function mountSwapBridgeScene(
  mountedScenes: MountedSwapBridgeScenes,
  tab: SwapBridgeTab,
): MountedSwapBridgeScenes {
  if (mountedScenes[tab]) {
    return mountedScenes;
  }

  return {
    ...mountedScenes,
    [tab]: true,
  };
}
