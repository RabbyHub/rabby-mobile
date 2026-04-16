import {
  createWorkletRuntime,
  isWorkletFunction,
  runOnRuntime,
} from 'react-native-reanimated';

const sqliteSyncRuntime = createWorkletRuntime('sqlite-sync');

export function runSqliteSyncWorklet<T extends (...args: unknown[]) => unknown>(
  worklet: T,
) {
  if (!isWorkletFunction(worklet)) {
    throw new Error('The provided function is not a worklet function.');
  }

  return runOnRuntime(sqliteSyncRuntime, worklet);
}
