import BigNumber from 'bignumber.js';
import { createWorkletRuntime, runOnRuntime } from 'react-native-reanimated';

const computeRuntime = createWorkletRuntime('compute', () => {
  'worklet';
  // Initialization code for the compute runtime can go here.

  // @ts-expect-error
  if (!global.BigNumber) {
    // @ts-expect-error
    global.BigNumber = BigNumber;
  }
});

export function runOnComputeRt<T>(worklet: () => T) {
  'worklet';
  return runOnRuntime(computeRuntime, worklet);
}

function jsonReplacer(key: string, value: any) {
  'worklet';
  // if (key === 'bg') {
  //   console.log('[perf] jsonReplacer:: replacer bg', value, BigNumber.isBigNumber(value));
  // }
  if (value instanceof BigNumber || BigNumber.isBigNumber(value)) {
    return {
      dataType: 'BigNumber',
      value: value.toFraction(),
    };
  }
  switch (typeof value) {
    case 'bigint':
      return value.toString();
    case 'object': {
      if (value instanceof Map) {
        return {
          dataType: 'Map',
          value: Array.from(value.entries()),
        };
      }
      if (value instanceof Set) {
        return {
          dataType: 'Set',
          value: Array.from(value.values()),
        };
      }
      break;
    }
  }
  return value;
}

function jsonReviver(key: string, value: any) {
  'worklet';
  switch (typeof value) {
    case 'object': {
      if (value === null) {
        return value;
      }
      if (value.dataType === 'Map') {
        return new Map(value.value);
      }
      if (value.dataType === 'Set') {
        return new Set(value.value);
      }
      if (value.dataType === 'BigNumber') {
        return new BigNumber(value.value);
      }
      break;
    }
  }
  return value;
}

export const rtConverter = {
  fromJS: <T = any>(data: T) => {
    'worklet';
    return JSON.stringify(data, jsonReplacer);
  },
  fromUI: <T = any>(data: string) => {
    'worklet';
    return JSON.parse(data, jsonReviver) as T;
  },
};
