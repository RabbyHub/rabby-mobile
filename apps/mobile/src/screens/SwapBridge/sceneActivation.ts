import type { SwapBridgeTab } from '@/navigation-type';

export function isSwapBridgeSceneActive({
  activeTab,
  scene,
  screenFocused,
}: {
  activeTab: SwapBridgeTab;
  scene: SwapBridgeTab;
  screenFocused: boolean;
}) {
  return screenFocused && activeTab === scene;
}
