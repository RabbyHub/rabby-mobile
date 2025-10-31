import { isEqual } from 'lodash';
import { useRef } from 'react';

function depsAreSame(oldDeps: any[], deps: any[]) {
  if (oldDeps.length !== deps.length) return false;
  for (let i = 0; i < oldDeps.length; i++) {
    if (!Object.is(oldDeps[i], deps[i])) return false;
  }
  return true;
}

export function useCreationWithShallowCompare<T = any>(
  factory: () => T,
  deps: any[],
) {
  const current = useRef({
    deps: deps,
    obj: undefined as undefined | T,
    initialized: false,
  }).current;

  if (current.initialized === false || !depsAreSame(current.deps, deps)) {
    current.deps = deps;
    current.obj = factory();
    current.initialized = true;
  }

  return current.obj as T;
}

function deepDepsAreSame(oldDeps: any[], deps: any[]) {
  if (oldDeps.length !== deps.length) return false;
  for (let i = 0; i < oldDeps.length; i++) {
    if (!isEqual(oldDeps[i], deps[i])) return false;
  }
  return true;
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

  if (current.initialized === false || !deepDepsAreSame(current.deps, deps)) {
    current.deps = deps;
    current.obj = factory();
    current.initialized = true;
  }

  return current.obj as T;
}
