import { zCreate } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { StoreApi, UseBoundStore } from 'zustand';

export class BaseStore<TState extends object> {
  protected readonly store: UseBoundStore<StoreApi<TState>>;

  constructor(initialState: TState) {
    this.store = zCreate<TState>(() => initialState);
  }

  get useStore() {
    return this.store;
  }

  getState() {
    return this.store.getState();
  }

  setState(
    updater:
      | Partial<TState>
      | TState
      | ((prev: TState) => Partial<TState> | TState | TState),
  ) {
    this.store.setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) {
        return prev;
      }
      if (typeof next !== 'object' || next === null || Array.isArray(next)) {
        return next as TState;
      }
      return {
        ...prev,
        ...next,
      };
    });
  }

  subscribe(...args: Parameters<UseBoundStore<StoreApi<TState>>['subscribe']>) {
    return this.store.subscribe(...args);
  }

  protected setField<TKey extends keyof TState>(
    key: TKey,
    valOrFunc: UpdaterOrPartials<TState[TKey]>,
    options?: Parameters<typeof resolveValFromUpdater<TState[TKey]>>[2],
  ) {
    this.store.setState(prev => {
      const result = resolveValFromUpdater(prev[key], valOrFunc, options);
      if (!result.changed) {
        return prev;
      }
      return {
        ...prev,
        [key]: result.newVal,
      };
    });
  }

  protected createAvoidParallelAsyncMethod<TArgs extends any[], TResult>(
    func: (...args: TArgs) => Promise<TResult>,
  ) {
    return makeAvoidParallelAsyncFunc(func);
  }
}
