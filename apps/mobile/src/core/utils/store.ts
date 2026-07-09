import { isEqual } from 'lodash';

import {
  scheduleStartupTask,
  type StartupTaskHandle,
  type StartupTaskOptions,
  type StartupTaskStage,
} from './startupScheduler';

export type UpdaterOrPartials<Val = unknown> =
  | (Val extends any[] ? Val[number][] : Partial<Val>)
  | ((prev: Val) => Val);
export function resolveValFromUpdater<Val = unknown>(
  prevVal: Val,
  input: UpdaterOrPartials<Val>,
  options?: {
    /**
     * @default true
     */
    strict?: boolean | ((prevVal: Val, newVal: Val) => boolean);
    /**
     * @default true
     */
    destructuringObjInput?: boolean;
  },
) {
  let strictCompare = options?.strict ?? true;
  const { destructuringObjInput = !strictCompare } = options || {};

  const ret = {
    newVal: prevVal,
    changed: false,
    isNonFuncInput: typeof input !== 'function',
    isChangedObjectInput: false,
  };
  if (typeof input === 'function') {
    strictCompare = strictCompare ?? true;
    ret.newVal = input(prevVal);
  } else if (typeof input === 'object') {
    if (strictCompare === undefined) {
      strictCompare = !destructuringObjInput;
    }

    if (strictCompare && destructuringObjInput) {
      strictCompare = false;
      console.warn(
        '[resolveValFromUpdater] Warning: strict mode with destructuringObjInput may cause unnecessary compare.',
      );
    }
    ret.isChangedObjectInput = prevVal !== input;
    if (Array.isArray(prevVal)) {
      ret.newVal = !destructuringObjInput
        ? (input as any as Val)
        : ([...(input as any[])] as Val);
    } else {
      ret.newVal = !destructuringObjInput
        ? (input as any as Val)
        : { ...prevVal, ...input };
    }
  } else {
    strictCompare = strictCompare ?? true;
    // for primitive type
    ret.newVal = input as Val;
  }

  if (typeof strictCompare === 'function') {
    ret.changed = strictCompare(prevVal, ret.newVal);
  } else if (strictCompare) {
    ret.changed = !isEqual(prevVal, ret.newVal);
  } else {
    ret.changed = prevVal !== ret.newVal;
  }

  return ret;
}

export {
  makeAvoidParallelFunc,
  makeAvoidParallelAsyncFunc,
} from './concurrency';

export type RunIIFEFuncStage = StartupTaskStage;

export type RunIIFEFuncOptions = StartupTaskOptions;

type ScheduledIIFEFunc = StartupTaskHandle;

function isRunIIFEFuncOptions(value: unknown): value is RunIIFEFuncOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return (
    'stage' in value ||
    'label' in value ||
    'owner' in value ||
    'reason' in value ||
    'priority' in value ||
    'delayMs' in value ||
    'fallbackMs' in value ||
    'idleTimeoutMs' in value ||
    'budgetMs' in value
  );
}

/**
 * @description mark and optionally schedule module-level side effects.
 */
export function runIIFEFunc<T extends (...args: any[]) => any>(
  func: T,
  optionsOrFirstArg?: RunIIFEFuncOptions | Parameters<T>[0],
  ...restArgs: any[]
): ReturnType<T> | ScheduledIIFEFunc | undefined {
  const hasOptions = isRunIIFEFuncOptions(optionsOrFirstArg);
  const options = hasOptions
    ? (optionsOrFirstArg as RunIIFEFuncOptions)
    : ({} as RunIIFEFuncOptions);
  const inputArgs = (
    hasOptions
      ? restArgs
      : optionsOrFirstArg === undefined
      ? restArgs
      : [optionsOrFirstArg, ...restArgs]
  ) as Parameters<T>;

  return scheduleStartupTask(() => func(...inputArgs), {
    ...options,
    tracePrefix: 'iife_task',
  }) as ReturnType<T> | ScheduledIIFEFunc | undefined;
}

export function runDevIIFEFunc<T extends (...args: any[]) => any>(
  func: T,
  ...inputArags: any[]
) {
  if (__DEV__) {
    return func(...inputArags);
  }
  return undefined;
}
