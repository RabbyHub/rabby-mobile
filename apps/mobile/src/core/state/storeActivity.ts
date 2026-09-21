import type { StoreApi } from 'zustand/vanilla';

type ActivityListener = () => void;
type StoreChangeListener<State> = Parameters<StoreApi<State>['subscribe']>[0];

export type ReadonlyStoreApi<State> = Pick<
  StoreApi<State>,
  'getState' | 'getInitialState' | 'subscribe'
>;

export type ActivityBoundStoreDiagnostics = {
  label: string;
  consumerCount: number;
  sourceSubscribed: boolean;
  activationCount: number;
  deactivationCount: number;
  sourceSubscribeCount: number;
  sourceUnsubscribeCount: number;
  sourceNotificationCount: number;
  publishedNotificationCount: number;
  catchUpCount: number;
};

export type StoreActivityScopeDiagnostics = {
  label: string;
  active: boolean;
  stores: ActivityBoundStoreDiagnostics[];
};

export type ActivityBoundStore<State> = ReadonlyStoreApi<State> & {
  getActivityDiagnostics: () => ActivityBoundStoreDiagnostics;
};

export type StoreActivityScope = {
  getActive: () => boolean;
  setActive: (active: boolean) => void;
  bindStore: <State>(
    store: ReadonlyStoreApi<State>,
    label?: string,
  ) => ActivityBoundStore<State>;
  getDiagnostics: () => StoreActivityScopeDiagnostics;
  dispose: () => void;
};

type CreateStoreActivityScopeOptions = {
  active?: boolean;
  label?: string;
};

class ActivityBoundStoreImpl<State> {
  private readonly listeners = new Set<StoreChangeListener<State>>();
  private currentSnapshot: State;
  private sourceUnsubscribe: (() => void) | null = null;
  private activityUnsubscribe: (() => void) | null = null;
  private label: string;
  private activationCount = 0;
  private deactivationCount = 0;
  private sourceSubscribeCount = 0;
  private sourceUnsubscribeCount = 0;
  private sourceNotificationCount = 0;
  private publishedNotificationCount = 0;
  private catchUpCount = 0;

  readonly api: ActivityBoundStore<State>;

  constructor(
    private readonly source: ReadonlyStoreApi<State>,
    private readonly activity: StoreActivityScopeImpl,
    label: string,
  ) {
    this.label = label;
    this.currentSnapshot = source.getState();
    this.api = {
      getState: this.getState,
      getInitialState: this.getInitialState,
      subscribe: this.subscribe,
      getActivityDiagnostics: this.getDiagnostics,
    };
  }

  updateLabel(label?: string) {
    if (label && this.label === 'anonymous-store') {
      this.label = label;
    }
  }

  dispose() {
    this.listeners.clear();
    this.stopObservingActivity();
  }

  private readonly getState = () => this.currentSnapshot;

  private readonly getInitialState = () => this.currentSnapshot;

  private readonly subscribe = (listener: StoreChangeListener<State>) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.startObservingActivity();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopObservingActivity();
      }
    };
  };

  readonly getDiagnostics = (): ActivityBoundStoreDiagnostics => ({
    label: this.label,
    consumerCount: this.listeners.size,
    sourceSubscribed: this.sourceUnsubscribe !== null,
    activationCount: this.activationCount,
    deactivationCount: this.deactivationCount,
    sourceSubscribeCount: this.sourceSubscribeCount,
    sourceUnsubscribeCount: this.sourceUnsubscribeCount,
    sourceNotificationCount: this.sourceNotificationCount,
    publishedNotificationCount: this.publishedNotificationCount,
    catchUpCount: this.catchUpCount,
  });

  private startObservingActivity() {
    if (this.activityUnsubscribe) {
      return;
    }

    this.activityUnsubscribe = this.activity.subscribe(
      this.handleActivityChange,
    );
    this.handleActivityChange();
  }

  private stopObservingActivity() {
    this.deactivate();
    this.activityUnsubscribe?.();
    this.activityUnsubscribe = null;
  }

  private readonly handleActivityChange = () => {
    if (this.activity.getActive()) {
      this.activate();
    } else {
      this.deactivate();
    }
  };

  private activate() {
    if (this.sourceUnsubscribe || this.listeners.size === 0) {
      return;
    }

    this.activationCount += 1;
    this.sourceSubscribeCount += 1;
    this.sourceUnsubscribe = this.source.subscribe(
      this.handleSourceNotification,
    );

    const syncResult = this.syncSnapshot();
    if (syncResult.changed) {
      this.catchUpCount += 1;
      this.publish(syncResult.previousSnapshot);
    }
  }

  private deactivate() {
    if (!this.sourceUnsubscribe) {
      return;
    }

    const unsubscribe = this.sourceUnsubscribe;
    this.sourceUnsubscribe = null;
    this.deactivationCount += 1;
    this.sourceUnsubscribeCount += 1;
    unsubscribe();
  }

  private readonly handleSourceNotification = () => {
    if (!this.sourceUnsubscribe) {
      return;
    }

    this.sourceNotificationCount += 1;
    const syncResult = this.syncSnapshot();
    if (syncResult.changed) {
      this.publish(syncResult.previousSnapshot);
    }
  };

  private syncSnapshot() {
    const nextSnapshot = this.source.getState();
    if (Object.is(this.currentSnapshot, nextSnapshot)) {
      return {
        changed: false as const,
        previousSnapshot: this.currentSnapshot,
      };
    }

    const previousSnapshot = this.currentSnapshot;
    this.currentSnapshot = nextSnapshot;
    return {
      changed: true as const,
      previousSnapshot,
    };
  }

  private publish(previousSnapshot: State) {
    this.publishedNotificationCount += 1;
    [...this.listeners].forEach(listener =>
      listener(this.currentSnapshot, previousSnapshot),
    );
  }
}

class StoreActivityScopeImpl implements StoreActivityScope {
  private readonly activityListeners = new Set<ActivityListener>();
  private readonly stores = new Map<
    ReadonlyStoreApi<unknown>,
    ActivityBoundStoreImpl<unknown>
  >();
  private active: boolean;
  private disposed = false;
  private readonly label: string;

  constructor(options: CreateStoreActivityScopeOptions) {
    this.active = options.active ?? true;
    this.label = options.label ?? 'anonymous-scope';
  }

  readonly getActive = () => this.active;

  readonly setActive = (active: boolean) => {
    if (this.disposed || this.active === active) {
      return;
    }

    this.active = active;
    [...this.activityListeners].forEach(listener => listener());
  };

  readonly subscribe = (listener: ActivityListener) => {
    if (this.disposed) {
      return () => {};
    }

    this.activityListeners.add(listener);
    return () => {
      this.activityListeners.delete(listener);
    };
  };

  readonly bindStore = <State>(
    store: ReadonlyStoreApi<State>,
    label?: string,
  ): ActivityBoundStore<State> => {
    const storeKey = store as ReadonlyStoreApi<unknown>;
    const existing = this.stores.get(storeKey);
    if (existing) {
      existing.updateLabel(label);
      return existing.api as ActivityBoundStore<State>;
    }

    const boundStore = new ActivityBoundStoreImpl(
      store,
      this,
      label ?? 'anonymous-store',
    );
    this.stores.set(storeKey, boundStore as ActivityBoundStoreImpl<unknown>);
    return boundStore.api;
  };

  readonly getDiagnostics = (): StoreActivityScopeDiagnostics => ({
    label: this.label,
    active: this.active,
    stores: [...this.stores.values()].map(store => store.getDiagnostics()),
  });

  readonly dispose = () => {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.activityListeners.clear();
    this.stores.forEach(store => store.dispose());
    this.stores.clear();
  };
}

export function createStoreActivityScope(
  options: CreateStoreActivityScopeOptions = {},
): StoreActivityScope {
  return new StoreActivityScopeImpl(options);
}
