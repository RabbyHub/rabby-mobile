import { mCreate, zCreate, zMutative } from '@/core/utils/reexports';
import {
  makeAvoidParallelAsyncFunc,
  resolveValFromUpdater,
  UpdaterOrPartials,
} from '@/core/utils/store';
import type { Draft } from 'mutative';
import { StoreApi, UseBoundStore } from 'zustand';

export type BaseStoreOptions = {
  mutative?: boolean;
  mutativeOptions?: Parameters<typeof zMutative>[1];
};

export class BaseStore<TState extends object> {
  protected readonly store: UseBoundStore<StoreApi<TState>>;
  private readonly isMutativeStore: boolean;

  constructor(initialState: TState, options?: BaseStoreOptions) {
    this.isMutativeStore = !!options?.mutative;
    this.store = options?.mutative
      ? (zCreate(
          zMutative<TState>(
            () => initialState,
            options.mutativeOptions as Parameters<typeof zMutative<TState>>[1],
          ),
        ) as unknown as UseBoundStore<StoreApi<TState>>)
      : zCreate<TState>(() => initialState);
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

  protected mutateState(recipe: (draft: Draft<TState>) => void) {
    if (this.isMutativeStore) {
      this.store.setState(recipe as unknown as (prev: TState) => TState);
      return;
    }

    this.store.setState(prev => mCreate(prev, recipe));
  }

  protected createAvoidParallelAsyncMethod<TArgs extends any[], TResult>(
    func: (...args: TArgs) => Promise<TResult>,
  ) {
    return makeAvoidParallelAsyncFunc(func);
  }
}
