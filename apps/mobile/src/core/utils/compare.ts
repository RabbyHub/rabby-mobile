import { isEqual } from 'lodash';

export function depsAreShallowSame(oldDeps: any[], deps: any[]) {
  if (oldDeps.length !== deps.length) return false;
  for (let i = 0; i < oldDeps.length; i++) {
    if (!Object.is(oldDeps[i], deps[i])) return false;
  }
  return true;
}

export function depsAreShallowL2Same(oldDeps: any[], deps: any[]) {
  if (oldDeps.length !== deps.length) return false;
  for (let i = 0; i < oldDeps.length; i++) {
    if (Object.is(oldDeps[i], deps[i])) continue;

    if (Array.isArray(oldDeps[i]) && Array.isArray(deps[i])) {
      if (!depsAreShallowSame(oldDeps[i], deps[i])) return false;
    } else {
      return false;
    }
  }
  return true;
}

export function depsAreDeepSame(oldDeps: any[], deps: any[]) {
  if (oldDeps.length !== deps.length) return false;
  for (let i = 0; i < oldDeps.length; i++) {
    if (!isEqual(oldDeps[i], deps[i])) return false;
  }
  return true;
}
