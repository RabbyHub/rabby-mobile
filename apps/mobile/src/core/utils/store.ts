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

export type RunStartupTaskStage = StartupTaskStage;

export type RunStartupTaskOptions = StartupTaskOptions;

type ScheduledStartupTask = StartupTaskHandle;

function isRunStartupTaskOptions(value: unknown): value is RunStartupTaskOptions {
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
 * @description run a task through startup metadata and stage scheduling.
 */
export function runStartupTask<T extends (...args: any[]) => any>(
  func: T,
  optionsOrFirstArg?: RunStartupTaskOptions | Parameters<T>[0],
  ...restArgs: any[]
): ReturnType<T> | ScheduledStartupTask | undefined {
  const hasOptions = isRunStartupTaskOptions(optionsOrFirstArg);
  const options = hasOptions
    ? (optionsOrFirstArg as RunStartupTaskOptions)
    : ({} as RunStartupTaskOptions);
  const inputArgs = (
    hasOptions
      ? restArgs
      : optionsOrFirstArg === undefined
      ? restArgs
      : [optionsOrFirstArg, ...restArgs]
  ) as Parameters<T>;

  return scheduleStartupTask(
    () => func(...inputArgs),
    options,
  ) as ReturnType<T> | ScheduledStartupTask | undefined;
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
