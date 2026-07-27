import { USD_CURRENCY } from '@/constant/currency';
import type { CurrencyServiceStore } from '@/core/services/currencyService';
import {
  bindCurrencyStoreListener,
  currencyServiceApi,
  getCurrencyStoreSnapshot,
} from '@/core/serviceApi/currency';
import { zCreate } from '@/core/utils/reexports';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import { formatCurrencyValueParts } from '@/utils/currency';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useMemo } from 'react';

// export const currencyServiceAtom = atom<typeof currencyService.store>(
//   currencyService.store,
// );

const currencyServiceStore = zCreate<CurrencyServiceStore>(() => {
  return getCurrencyStoreSnapshot();
});

let currencyStoreBindingPromise: Promise<void> | null = null;
let disposeCurrencyStoreBinding: (() => void) | null = null;
let currencyStoreBindingScheduled = false;

function ensureCurrencyStoreBinding() {
  if (disposeCurrencyStoreBinding || currencyStoreBindingPromise) {
    return currencyStoreBindingPromise || Promise.resolve();
  }

  currencyStoreBindingPromise = bindCurrencyStoreListener((k, v) => {
    currencyServiceStore.setState(prev => {
      if (prev[k] === v) return prev;

      prev = { ...prev, [k]: v };
      return prev;
    });
  })
    .then(dispose => {
      disposeCurrencyStoreBinding = dispose;
    })
    .catch(error => {
      currencyStoreBindingPromise = null;
      console.error(error);
    });

  return currencyStoreBindingPromise;
}

function scheduleCurrencyStoreBinding() {
  if (currencyStoreBindingScheduled || disposeCurrencyStoreBinding) {
    return;
  }

  currencyStoreBindingScheduled = true;
  scheduleStartupTask(
    () => ensureCurrencyStoreBinding(),
    STARTUP_TASKS.currencyServiceBinding,
  );
}

export function setCurrencyStore(
  valOrFunc: UpdaterOrPartials<CurrencyServiceStore['data']>,
) {
  return currencyServiceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.data, valOrFunc, {
      strict: false,
    });

    // sync to service store
    void currencyServiceApi.setStore(newVal).catch(console.error);

    return { ...prev, data: newVal };
  });
}

export function useCurrency() {
  useEffect(() => {
    scheduleCurrencyStoreBinding();
  }, []);

  const currencyStore = currencyServiceStore(s => s.data);

  const currency = useMemo(() => {
    return (
      currencyStore.currencyList.find(
        item => item.code === currencyStore.currency,
      ) || USD_CURRENCY
    );
  }, [currencyStore.currency, currencyStore.currencyList]);

  const setCurrentCurrency = useMemoizedFn((v: string) => {
    setCurrencyStore(prev => {
      return {
        ...prev,
        currency: v,
      };
    });
  });

  const formatCurrentCurrency = useCallback(
    (value: string | number) => {
      return formatCurrencyValueParts(value, { currency }).text;
    },
    [currency],
  );

  return {
    currency,
    currencyStore,
    setCurrencyStore,
    setCurrentCurrency,
    formatCurrentCurrency,
  };
}
