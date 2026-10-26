import { useStoreWithEqualityFn } from 'zustand/traditional';

import type { ReadonlyStoreApi } from '@/core/state/storeActivity';
import { useStoreActivityScope } from './StoreActivityProvider';

type EqualityFn<Selected> = (left: Selected, right: Selected) => boolean;

type UseActivityStoreOptions = {
  storeLabel?: string;
};

export function useActivityStore<State, Selected>(
  store: ReadonlyStoreApi<State>,
  selector: (state: State) => Selected,
  equalityFn: EqualityFn<Selected> = Object.is,
  options: UseActivityStoreOptions = {},
) {
  const activityScope = useStoreActivityScope();
  const activityStore = activityScope.bindStore(store, options.storeLabel);

  return useStoreWithEqualityFn(activityStore, selector, equalityFn);
}
