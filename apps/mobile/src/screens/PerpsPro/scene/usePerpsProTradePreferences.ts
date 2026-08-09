import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { perpsServiceApi } from '@/core/serviceApi/perps';
import type {
  PerpsProTradeAmountUnit,
  PerpsProTradeOrderType,
} from '@/core/services/perpsService';

type Listener = () => void;

interface Snapshot {
  amountUnit: PerpsProTradeAmountUnit;
  hydrated: boolean;
  orderType: PerpsProTradeOrderType;
}

interface Dependencies {
  getAmountUnit: () => Promise<PerpsProTradeAmountUnit>;
  getOrderType: () => Promise<PerpsProTradeOrderType>;
  setAmountUnit: (value: PerpsProTradeAmountUnit) => Promise<unknown>;
  setOrderType: (value: PerpsProTradeOrderType) => Promise<unknown>;
}

const DEFAULT_SNAPSHOT: Snapshot = {
  amountUnit: 'quote',
  hydrated: false,
  orderType: 'market',
};

export const createPerpsProTradePreferencesController = (
  dependencies: Dependencies,
) => {
  let snapshot = DEFAULT_SNAPSHOT;
  let hydratePromise: Promise<void> | null = null;
  let amountWriteGeneration = 0;
  let orderWriteGeneration = 0;
  const listeners = new Set<Listener>();
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const hydrate = () => {
    if (snapshot.hydrated) return Promise.resolve();
    if (hydratePromise) return hydratePromise;
    const amountGenerationAtStart = amountWriteGeneration;
    const orderGenerationAtStart = orderWriteGeneration;
    hydratePromise = Promise.all([
      dependencies.getAmountUnit(),
      dependencies.getOrderType(),
    ])
      .then(([amountUnit, orderType]) => {
        publish({
          amountUnit:
            amountWriteGeneration === amountGenerationAtStart
              ? amountUnit
              : snapshot.amountUnit,
          hydrated: true,
          orderType:
            orderWriteGeneration === orderGenerationAtStart
              ? orderType
              : snapshot.orderType,
        });
      })
      .catch(error => {
        console.error('[perpsProTradePreferences] hydrate failed', error);
        publish({ ...snapshot, hydrated: true });
      })
      .finally(() => {
        hydratePromise = null;
      });
    return hydratePromise;
  };
  const setAmountUnit = (amountUnit: PerpsProTradeAmountUnit) => {
    const previous = snapshot.amountUnit;
    const generation = ++amountWriteGeneration;
    publish({ ...snapshot, amountUnit });
    return dependencies.setAmountUnit(amountUnit).catch(error => {
      console.error(
        '[perpsProTradePreferences] save amount unit failed',
        error,
      );
      if (generation === amountWriteGeneration) {
        publish({ ...snapshot, amountUnit: previous });
      }
    });
  };
  const setOrderType = (orderType: PerpsProTradeOrderType) => {
    const previous = snapshot.orderType;
    const generation = ++orderWriteGeneration;
    publish({ ...snapshot, orderType });
    return dependencies.setOrderType(orderType).catch(error => {
      console.error('[perpsProTradePreferences] save order type failed', error);
      if (generation === orderWriteGeneration) {
        publish({ ...snapshot, orderType: previous });
      }
    });
  };
  return {
    getSnapshot: () => snapshot,
    hydrate,
    setAmountUnit,
    setOrderType,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const controller = createPerpsProTradePreferencesController({
  getAmountUnit: () => perpsServiceApi.getPerpsProTradeAmountUnit(),
  getOrderType: () => perpsServiceApi.getPerpsProTradeOrderType(),
  setAmountUnit: value => perpsServiceApi.setPerpsProTradeAmountUnit(value),
  setOrderType: value => perpsServiceApi.setPerpsProTradeOrderType(value),
});

export const usePerpsProTradePreferences = () => {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.hydrate();
  }, []);
  return useMemo(
    () => ({
      ...snapshot,
      setAmountUnit: controller.setAmountUnit,
      setOrderType: controller.setOrderType,
    }),
    [snapshot],
  );
};
