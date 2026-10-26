import {
  type DependencyList,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export type SceneActiveAsyncState<T> = {
  loading: boolean;
  value?: T;
  error?: unknown;
};

type SceneActiveAsyncHandlers<T> = {
  onStart: () => void;
  onValue: (value: T) => void;
  onError: (error: unknown) => void;
};

export function createSceneActiveAsyncController() {
  let active = false;
  let requestId = 0;

  return {
    setActive(nextActive: boolean) {
      active = nextActive;
      if (!active) {
        requestId += 1;
      }
    },
    run<T>(
      fn: () => Promise<T>,
      { onStart, onValue, onError }: SceneActiveAsyncHandlers<T>,
    ) {
      if (!active) {
        return () => undefined;
      }

      const currentRequestId = ++requestId;
      onStart();
      fn().then(
        value => {
          if (active && currentRequestId === requestId) {
            onValue(value);
          }
        },
        error => {
          if (active && currentRequestId === requestId) {
            onError(error);
          }
        },
      );

      return () => {
        if (currentRequestId === requestId) {
          requestId += 1;
        }
      };
    },
  };
}

export function useSceneActiveAsync<T>(
  fn: () => Promise<T>,
  active: boolean,
  deps: DependencyList,
): SceneActiveAsyncState<T> {
  const controllerRef = useRef<ReturnType<
    typeof createSceneActiveAsyncController
  > | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createSceneActiveAsyncController();
  }
  const [state, setState] = useState<SceneActiveAsyncState<T>>({
    loading: false,
  });

  // The caller owns the dependency list, matching react-use's async hooks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  useEffect(() => {
    const controller = controllerRef.current!;
    controller.setActive(active);
    if (!active) {
      return;
    }

    return controller.run(run, {
      onStart: () => {
        setState(previous =>
          previous.loading && previous.error === undefined
            ? previous
            : {
                ...previous,
                loading: true,
                error: undefined,
              },
        );
      },
      onValue: value => {
        setState({ loading: false, value });
      },
      onError: error => {
        setState({ loading: false, error });
      },
    });
  }, [active, run]);

  return state;
}
