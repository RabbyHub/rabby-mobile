import { createStore } from 'zustand/vanilla';

import {
  createStoreActivityScope,
  type ReadonlyStoreApi,
} from './storeActivity';

type CountState = {
  count: number;
};

function createTrackedCountStore() {
  const store = createStore<CountState>(() => ({ count: 0 }));
  let activeSubscriptions = 0;
  let totalSubscriptions = 0;
  let totalUnsubscriptions = 0;

  const trackedStore: ReadonlyStoreApi<CountState> = {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: listener => {
      activeSubscriptions += 1;
      totalSubscriptions += 1;
      const unsubscribe = store.subscribe(listener);
      return () => {
        activeSubscriptions -= 1;
        totalUnsubscriptions += 1;
        unsubscribe();
      };
    },
  };

  return {
    store,
    trackedStore,
    getSubscriptionStats: () => ({
      activeSubscriptions,
      totalSubscriptions,
      totalUnsubscriptions,
    }),
  };
}

describe('store activity scope', () => {
  it('shares one source subscription across consumers', () => {
    const source = createTrackedCountStore();
    const scope = createStoreActivityScope({ active: true, label: 'home' });
    const boundStore = scope.bindStore(source.trackedStore, 'wallet');
    const firstListener = jest.fn();
    const secondListener = jest.fn();

    const unsubscribeFirst = boundStore.subscribe(firstListener);
    const unsubscribeSecond = boundStore.subscribe(secondListener);

    expect(source.getSubscriptionStats().activeSubscriptions).toBe(1);

    source.store.setState({ count: 1 });

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(boundStore.getState()).toEqual({ count: 1 });

    unsubscribeFirst();
    expect(source.getSubscriptionStats().activeSubscriptions).toBe(1);

    unsubscribeSecond();
    expect(source.getSubscriptionStats()).toEqual({
      activeSubscriptions: 0,
      totalSubscriptions: 1,
      totalUnsubscriptions: 1,
    });
  });

  it('retains its published snapshot and stops source notifications while inactive', () => {
    const source = createTrackedCountStore();
    const scope = createStoreActivityScope({ active: true });
    const boundStore = scope.bindStore(source.trackedStore);
    const listener = jest.fn();
    const unsubscribe = boundStore.subscribe(listener);

    source.store.setState({ count: 1 });
    scope.setActive(false);

    for (let count = 2; count <= 100; count += 1) {
      source.store.setState({ count });
    }

    expect(boundStore.getState()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getSubscriptionStats().activeSubscriptions).toBe(0);
    expect(boundStore.getActivityDiagnostics()).toEqual(
      expect.objectContaining({
        sourceNotificationCount: 1,
        publishedNotificationCount: 1,
      }),
    );

    unsubscribe();
  });

  it('publishes only the latest snapshot once when activity resumes', () => {
    const source = createTrackedCountStore();
    const scope = createStoreActivityScope({ active: true });
    const boundStore = scope.bindStore(source.trackedStore);
    const listener = jest.fn();
    const unsubscribe = boundStore.subscribe(listener);

    scope.setActive(false);
    source.store.setState({ count: 1 });
    source.store.setState({ count: 2 });
    source.store.setState({ count: 3 });
    scope.setActive(true);

    expect(boundStore.getState()).toEqual({ count: 3 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(boundStore.getActivityDiagnostics()).toEqual(
      expect.objectContaining({
        activationCount: 2,
        deactivationCount: 1,
        catchUpCount: 1,
        publishedNotificationCount: 1,
      }),
    );

    unsubscribe();
  });

  it('does not publish on resume when the source snapshot did not change', () => {
    const source = createTrackedCountStore();
    const scope = createStoreActivityScope({ active: true });
    const boundStore = scope.bindStore(source.trackedStore);
    const listener = jest.fn();
    const unsubscribe = boundStore.subscribe(listener);

    scope.setActive(false);
    scope.setActive(true);

    expect(listener).not.toHaveBeenCalled();
    expect(boundStore.getActivityDiagnostics().catchUpCount).toBe(0);

    unsubscribe();
  });

  it('does not miss a source update that occurs while subscribing', () => {
    const store = createStore<CountState>(() => ({ count: 0 }));
    let updateOnNextSubscription = false;
    const source: ReadonlyStoreApi<CountState> = {
      getState: store.getState,
      getInitialState: store.getInitialState,
      subscribe: listener => {
        const unsubscribe = store.subscribe(listener);
        if (updateOnNextSubscription) {
          updateOnNextSubscription = false;
          store.setState({ count: 1 });
        }
        return unsubscribe;
      },
    };
    const scope = createStoreActivityScope({ active: false });
    const boundStore = scope.bindStore(source);
    const listener = jest.fn();
    const unsubscribe = boundStore.subscribe(listener);

    updateOnNextSubscription = true;
    scope.setActive(true);

    expect(boundStore.getState()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('cleans all subscriptions when the scope is disposed', () => {
    const source = createTrackedCountStore();
    const scope = createStoreActivityScope({ active: true });
    const boundStore = scope.bindStore(source.trackedStore);

    boundStore.subscribe(jest.fn());
    scope.dispose();

    expect(source.getSubscriptionStats().activeSubscriptions).toBe(0);
    source.store.setState({ count: 1 });
    expect(boundStore.getState()).toEqual({ count: 0 });
  });

  it('remains subscription-stable across 100 inactive update cycles', () => {
    const source = createTrackedCountStore();
    const scope = createStoreActivityScope({ active: true, label: 'home' });
    const boundStore = scope.bindStore(source.trackedStore, 'stress');
    const listener = jest.fn();
    const unsubscribe = boundStore.subscribe(listener);

    for (let cycle = 1; cycle <= 100; cycle += 1) {
      scope.setActive(false);
      for (let update = 1; update <= 20; update += 1) {
        source.store.setState({ count: cycle * 100 + update });
      }
      scope.setActive(true);
    }

    expect(listener).toHaveBeenCalledTimes(100);
    expect(source.getSubscriptionStats()).toEqual({
      activeSubscriptions: 1,
      totalSubscriptions: 101,
      totalUnsubscriptions: 100,
    });
    expect(boundStore.getActivityDiagnostics()).toEqual(
      expect.objectContaining({
        activationCount: 101,
        deactivationCount: 100,
        sourceNotificationCount: 0,
        publishedNotificationCount: 100,
        catchUpCount: 100,
      }),
    );

    unsubscribe();
    expect(source.getSubscriptionStats().activeSubscriptions).toBe(0);
  });
});
