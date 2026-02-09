import { depsAreDeepSame, depsAreShallowSame } from '@/core/utils/compare';
import { useRef } from 'react';

export function useCreationWithShallowCompare<T = any>(
  factory: () => T,
  deps: any[],
) {
  const current = useRef({
    deps: deps,
    obj: undefined as undefined | T,
    initialized: false,
  }).current;

  if (
    current.initialized === false ||
    !depsAreShallowSame(current.deps, deps)
  ) {
    current.deps = deps;
    current.obj = factory();
    current.initialized = true;
  }

  return current.obj as T;
}

export function useCreationWithDeepCompare<T = any>(
  factory: () => T,
  deps: any[],
) {
  const current = useRef({
    deps: deps,
    obj: undefined as undefined | T,
    initialized: false,
  }).current;

  if (current.initialized === false || !depsAreDeepSame(current.deps, deps)) {
    current.deps = deps;
    current.obj = factory();
    current.initialized = true;
  }

  return current.obj as T;
}
