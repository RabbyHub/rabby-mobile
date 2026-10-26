import type { SwapBridgeTab } from '@/navigation-type';

export function getSwapBridgeActiveTab(params?: object): SwapBridgeTab {
  return params && 'activeTab' in params && params.activeTab === 'bridge'
    ? 'bridge'
    : 'swap';
}

type ConsumableSwapNavigationParams = {
  isSwapToTokenDetail?: boolean;
  isFromSwap?: boolean;
};

export function shouldClearConsumedSwapNavigationParams(
  params?: ConsumableSwapNavigationParams,
) {
  return !!(params?.isSwapToTokenDetail || params?.isFromSwap);
}
