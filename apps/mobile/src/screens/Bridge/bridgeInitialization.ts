export type BridgeInitializationStatus = 'idle' | 'running' | 'ready';

export type BridgeInitializationRun = Readonly<{
  key: string;
  generation: number;
}>;

type BridgeInitializationSnapshot = Readonly<{
  key: string | null;
  generation: number;
  status: BridgeInitializationStatus;
}>;

export function createBridgeInitializationController() {
  let snapshot: BridgeInitializationSnapshot = {
    key: null,
    generation: 0,
    status: 'idle',
  };

  const isCurrent = (run: BridgeInitializationRun) =>
    snapshot.key === run.key && snapshot.generation === run.generation;

  return {
    getSnapshot: () => snapshot,

    begin(key: string): BridgeInitializationRun | null {
      if (
        snapshot.key === key &&
        (snapshot.status === 'running' || snapshot.status === 'ready')
      ) {
        return null;
      }

      const run = {
        key,
        generation: snapshot.generation + 1,
      };
      snapshot = {
        ...run,
        status: 'running',
      };
      return run;
    },

    isCurrent,

    complete(run: BridgeInitializationRun) {
      if (!isCurrent(run) || snapshot.status !== 'running') {
        return false;
      }

      snapshot = {
        ...snapshot,
        status: 'ready',
      };
      return true;
    },

    fail(run: BridgeInitializationRun) {
      if (!isCurrent(run) || snapshot.status !== 'running') {
        return false;
      }

      snapshot = {
        ...snapshot,
        status: 'idle',
      };
      return true;
    },

    cancel(run: BridgeInitializationRun) {
      if (!isCurrent(run) || snapshot.status !== 'running') {
        return false;
      }

      snapshot = {
        key: null,
        generation: snapshot.generation + 1,
        status: 'idle',
      };
      return true;
    },
  };
}
