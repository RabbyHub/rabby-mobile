import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useEffect, useLayoutEffect, useRef } from 'react';

import {
  createStoreActivityScope,
  type ReadonlyStoreApi,
  type StoreActivityScope,
} from '@/core/state/storeActivity';
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

/**
 * Activity-aware store subscription for owners that need their own visibility
 * signal instead of a surrounding boundary (for example a sheet that stays
 * mounted while closed).
 *
 * While inactive the bound store keeps its last snapshot and stops forwarding
 * source notifications, so consumers keep rendering the previous data instead
 * of being rewritten to an empty state. On activation it catches up from the
 * latest source snapshot in one publication.
 */
export function useScopedActivityStore<State, Selected>(
  active: boolean,
  store: ReadonlyStoreApi<State>,
  selector: (state: State) => Selected,
  equalityFn: EqualityFn<Selected> = Object.is,
  options: UseActivityStoreOptions = {},
) {
  const scopeRef = useRef<StoreActivityScope | null>(null);
  if (!scopeRef.current) {
    scopeRef.current = createStoreActivityScope({
      active,
      label: options.storeLabel ?? 'scoped-activity-store',
    });
  }
  const scope = scopeRef.current;

  useLayoutEffect(() => {
    scope.setActive(active);
  }, [active, scope]);

  useEffect(() => {
    return () => {
      scope.dispose();
    };
  }, [scope]);

  const activityStore = scope.bindStore(store, options.storeLabel);
  return useStoreWithEqualityFn(activityStore, selector, equalityFn);
}
