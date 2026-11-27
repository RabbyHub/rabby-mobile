import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

import { createSwapFormStore, type SwapFormState } from './swapFormStore';

/**
 * Swap scene store. Bridge gets its own instance when it is migrated; the
 * factory is scene agnostic so both can share it.
 */
export const swapFormStore = createSwapFormStore();

export function useSwapForm<T>(
  selector: (state: SwapFormState) => T,
  equality: (left: T, right: T) => boolean = Object.is,
) {
  return useActivityStore(swapFormStore, selector, equality, {
    storeLabel: 'swap-form',
  });
}

export { type SwapFormState };
