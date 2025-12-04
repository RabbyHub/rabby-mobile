import { USD_CURRENCY } from '@/constant/currency';
import { CurrencyServiceStore } from '@/core/services/currencyService';
import { currencyService } from '@/core/services/shared';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { formatCurrency } from '@/utils/number';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useMemo } from 'react';

// export const currencyServiceAtom = atom<typeof currencyService.store>(
//   currencyService.store,
// );

const currencyServiceStore = zCreate<CurrencyServiceStore>(() => {
  return currencyService.store;
});
currencyService.setBeforeSetKV((k, v) => {
  currencyServiceStore.setState(prev => {
    if (prev[k] === v) return prev;

    prev = { ...prev, [k]: v };
    return prev;
  });
});

export function setCurrencyStore(
  valOrFunc: UpdaterOrPartials<CurrencyServiceStore['data']>,
) {
  return currencyServiceStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.data, valOrFunc, {
      strict: false,
    });

    // sync to service store
    currencyService.setStore(newVal);

    return { ...prev, data: newVal };
  });
}

// export const currencyAtom = atom(
//   get => get(currencyServiceAtom).data || {},
//   (
//     get,
//     set,
//     newVal:
//       | (typeof currencyService.store)['data']
//       | ((
//           v: (typeof currencyService.store)['data'],
//         ) => (typeof currencyService.store)['data']),
//   ) => {
//     const prev = get(currencyServiceAtom);
//     const nextVal = typeof newVal === 'function' ? newVal(prev.data) : newVal;
//     const res = { ...prev, data: nextVal };
//     currencyService.setStore(nextVal);
//     set(currencyServiceAtom, res);
//   },
// );

export function useCurrency() {
  // const [currencyStore, setCurrencyStore] = useAtom(currencyAtom);
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
      return formatCurrency(value, {
        // currency
        currency: currency,
      });
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
