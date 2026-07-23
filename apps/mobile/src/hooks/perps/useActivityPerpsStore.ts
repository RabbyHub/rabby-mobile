import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { perpsStore } from './usePerpsStore';

type PerpsState = ReturnType<typeof perpsStore.getState>;

export function useActivityPerpsStore<Selected>(
  selector: (state: PerpsState) => Selected,
  equalityFn: (left: Selected, right: Selected) => boolean = Object.is,
) {
  return useActivityStore(perpsStore, selector, equalityFn, {
    storeLabel: 'perps',
  });
}
