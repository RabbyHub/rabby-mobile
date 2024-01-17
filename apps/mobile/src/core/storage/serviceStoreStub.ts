import { useEffect } from 'react';
import { atom, useAtom } from 'jotai';

import { dappService } from '../services/shared';
import { FieldNilable } from '@rabby-wallet/base-utils';

const dappServiceAtom = atom<FieldNilable<typeof dappService.store>>(
  dappService.store,
);

export const dappsAtom = atom(
  get => get(dappServiceAtom).dapps || {},
  (get, set, newVal: (typeof dappService.store)['dapps']) => {
    const prev = get(dappServiceAtom);
    set(dappServiceAtom, { ...prev, dapps: newVal });
  },
);

/**
 * @description only call this hook on app's top level
 */
export function useSetupServiceStub() {
  const [, setDappServices] = useAtom(dappServiceAtom);

  useEffect(() => {
    const disposes: Function[] = [];

    dappService.setBeforeSetKV((k, v) => {
      setDappServices(prev => ({ ...prev, [k]: v }));
    }, disposes);

    return () => {
      disposes.forEach(dispose => dispose());
    };
  }, [setDappServices]);
}
