import { isEqual } from 'lodash';
import { InteractionManager } from 'react-native';

import {
  runAfterHomePostStartupReady,
  traceHomeStartupReady,
} from './homeStartupReady';
import { traceAndroidInstant } from './androidTrace';

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

export type RunIIFEFuncStage =
  | 'immediate'
  | 'homePostStartupReady'
  | 'homePostStartupIdle';

export type RunIIFEFuncOptions = {
  label?: string;
  stage?: RunIIFEFuncStage;
  delayMs?: number;
  fallbackMs?: number;
  idleTimeoutMs?: number;
};

type ScheduledIIFEFunc = {
  cancel: () => void;
};

function isRunIIFEFuncOptions(value: unknown): value is RunIIFEFuncOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return (
    'stage' in value ||
    'label' in value ||
    'delayMs' in value ||
    'fallbackMs' in value ||
    'idleTimeoutMs' in value
  );
}

function traceIIFEFunc(
  event: string,
  options: RunIIFEFuncOptions,
  extra?: Record<string, unknown>,
) {
  if (!options.label) {
    return;
  }

  const payload = {
    label: options.label,
    stage: options.stage ?? 'immediate',
    ...extra,
  };
  traceAndroidInstant(`iife_task.${event}`, payload);
  traceHomeStartupReady(`iife_task_${event}`, payload);
}

function runIIFEFuncTask<T extends (...args: any[]) => any>(
  func: T,
  options: RunIIFEFuncOptions,
  inputArgs: Parameters<T>,
) {
  traceIIFEFunc('fire', options);
  try {
    const result = func(...inputArgs);
    if (result && typeof result.then === 'function') {
      result.then(
        () => {
          traceIIFEFunc('done', options);
        },
        (error: unknown) => {
          traceIIFEFunc('error', options, {
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`[runIIFEFunc] ${options.label || 'anonymous'}`, error);
        },
      );
    } else {
      traceIIFEFunc('done', options);
    }
    return result;
  } catch (error) {
    traceIIFEFunc('error', options, {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`[runIIFEFunc] ${options.label || 'anonymous'}`, error);
    return undefined;
  }
}

function scheduleHomePostStartupIdle<T extends (...args: any[]) => any>(
  func: T,
  options: RunIIFEFuncOptions,
  inputArgs: Parameters<T>,
): ScheduledIIFEFunc {
  let disposed = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let idleId: ReturnType<typeof requestIdleCallback> | null = null;
  let interactionHandle: ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null = null;

  const cancelHomePostStartupReady = runAfterHomePostStartupReady(
    () => {
      if (disposed) {
        return;
      }

      const scheduleIdleTask = () => {
        interactionHandle = InteractionManager.runAfterInteractions(() => {
          if (disposed) {
            return;
          }

          if (typeof requestIdleCallback === 'function') {
            idleId = requestIdleCallback(
              () => {
                if (!disposed) {
                  runIIFEFuncTask(func, options, inputArgs);
                }
              },
              { timeout: options.idleTimeoutMs ?? 5000 },
            );
            return;
          }

          runIIFEFuncTask(func, options, inputArgs);
        });
      };

      if (options.delayMs && options.delayMs > 0) {
        timeoutId = setTimeout(scheduleIdleTask, options.delayMs);
        return;
      }

      scheduleIdleTask();
    },
    {
      label: options.label,
      fallbackMs: options.fallbackMs,
    },
  );

  return {
    cancel: () => {
      disposed = true;
      cancelHomePostStartupReady();
      interactionHandle?.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (idleId !== null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
    },
  };
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
  const stage = options.stage ?? 'immediate';

  traceIIFEFunc('schedule', options);

  if (stage === 'homePostStartupReady') {
    return {
      cancel: runAfterHomePostStartupReady(
        () => {
          runIIFEFuncTask(func, options, inputArgs);
        },
        {
          label: options.label,
          fallbackMs: options.fallbackMs,
        },
      ),
    };
  }

  if (stage === 'homePostStartupIdle') {
    return scheduleHomePostStartupIdle(func, options, inputArgs);
  }

  return runIIFEFuncTask(func, options, inputArgs);
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
