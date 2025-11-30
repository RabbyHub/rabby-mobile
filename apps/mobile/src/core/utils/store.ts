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

export function makeAvoidParallelFunc<T extends (...args: any[]) => any>(
  func: T,
) {
  const executingRef = { current: false };

  const wrappedFunc = (...args: Parameters<T>): void => {
    if (executingRef.current) return;

    let err: Error | null = null;
    try {
      executingRef.current = true;
      return func(...args);
    } catch (error) {
      err = error as Error;
    } finally {
      executingRef.current = false;
    }

    if (err) throw err;
  };

  return wrappedFunc;
}

export function makeAvoidParallelAsyncFunc<
  T extends (...args: any[]) => Promise<any>,
>(func: T) {
  // type RetValue = Awaited<ReturnType<T>>;
  type PromiseRet = Promise<Awaited<ReturnType<T>>>;
  const promiseRef = { current: null as PromiseRet | null };

  const wrappedFunc = async (
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> => {
    if (promiseRef.current) return promiseRef.current;

    let ret: PromiseRet | Error;
    try {
      ret = func(...args);

      if (typeof ret.then === 'function')
        promiseRef.current = ret as ReturnType<T>;

      await ret;
    } catch (error) {
      ret = error as Error;
    } finally {
      promiseRef.current = null;
    }

    if (ret instanceof Error) throw ret;

    return ret;
  };

  return wrappedFunc;
}

/**
 * @description nothing, just run it, mark it `iife` with this method
 */
export function runIIFEFunc<T extends (...args: any[]) => any>(
  func: T,
  ...inputArags: any[]
) {
  return func(...inputArags);
}
