import { USD_CURRENCY } from '@/constant/currency';
import { currencyService } from '@/core/services/shared';
import { formatCurrency } from '@/utils/number';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';

export const currencyServiceAtom = atom<typeof currencyService.store>(
  currencyService.store,
);

export const currencyAtom = atom(
  get => get(currencyServiceAtom).data || {},
  (
    get,
    set,
    newVal:
      | (typeof currencyService.store)['data']
      | ((
          v: (typeof currencyService.store)['data'],
        ) => (typeof currencyService.store)['data']),
  ) => {
    const prev = get(currencyServiceAtom);
    const nextVal = typeof newVal === 'function' ? newVal(prev.data) : newVal;
    const res = { ...prev, data: nextVal };
    currencyService.setStore(nextVal);
    set(currencyServiceAtom, res);
  },
);

export function useCurrency() {
  const [currencyStore, setCurrencyStore] = useAtom(currencyAtom);

  const currency = useMemo(() => {
    return (
      currencyStore.currencyList.find(
        item => item.currency_name === currencyStore.currency,
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
