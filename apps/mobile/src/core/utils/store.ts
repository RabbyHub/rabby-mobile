import { isEqual } from 'lodash';

export type UpdaterOrPartials<Val = unknown> =
  | (Val extends any[] ? Val[number][] : Partial<Val>)
  | ((prev: Val) => Val);
export function resolveValFromUpdater<Val = unknown>(
  prev: Val,
  input: UpdaterOrPartials<Val>,
  options?: { strict?: boolean },
) {
  const ret = {
    newVal: prev,
    hasDetectChanged: false,
    changed: false,
  };
  if (typeof input === 'function') {
    ret.newVal = input(prev);
  } else if (typeof input === 'object') {
    if (Array.isArray(prev)) {
      ret.newVal = [...(input as any[])] as Val;
    } else {
      ret.newVal = { ...prev, ...input };
    }
  } else {
    // for primitive type
    ret.newVal = input as Val;
  }

  const { strict = true } = options || {};
  if (strict) {
    ret.changed = !isEqual(prev, ret.newVal);
    ret.hasDetectChanged = true;
  }

  return ret;
}

export {
  makeAvoidParallelFunc,
  makeAvoidParallelAsyncFunc,
} from './concurrency';

/**
 * @description nothing, just run it, mark it `iife` with this method
 */
export function runIIFEFunc<T extends (...args: any[]) => any>(
  func: T,
  ...inputArags: any[]
) {
  return func(...inputArags);
}
