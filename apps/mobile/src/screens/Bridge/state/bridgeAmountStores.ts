import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

import {
  createBridgeAmountStore,
  type BridgeAmountState,
} from './bridgeAmountStore';

export const bridgeAmountStore = createBridgeAmountStore();

export function useBridgeAmount<T>(
  selector: (state: BridgeAmountState) => T,
  equality: (left: T, right: T) => boolean = Object.is,
) {
  return useActivityStore(bridgeAmountStore, selector, equality, {
    storeLabel: 'bridge-amount',
  });
}
