import { createWorkletRuntime, runOnRuntime } from 'react-native-reanimated';

const runtimeDataLoad = createWorkletRuntime('dataLoad');

export function runOnDataLoad<T extends (...args: any[]) => any>(fn: T) {
  return runOnRuntime<Parameters<T>, ReturnType<T>>(runtimeDataLoad, fn);
}
