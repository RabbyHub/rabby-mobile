import { useEffect } from 'react';
import { atom, useAtom } from 'jotai';

import { dappService, swapService } from '../services/shared';
import { FieldNilable } from '@rabby-wallet/base-utils';
import { currentAccountAtom } from '@/hooks/account';
import { useMount } from 'ahooks';
import { EVENT_SWITCH_ACCOUNT, eventBus } from '@/utils/events';

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
  const [, setCurrentAccount] = useAtom(currentAccountAtom);

  useEffect(() => {
    const disposes: Function[] = [];

    dappService.setBeforeSetKV((k, v) => {
      setDappServices(prev => ({ ...prev, [k]: v }));
    }, disposes);

    return () => {
      disposes.forEach(dispose => dispose());
    };
  }, [setDappServices]);

  useMount(() => {
    eventBus.on(EVENT_SWITCH_ACCOUNT, (v: any) => {
      console.log('vvvvvv', v);
      setCurrentAccount(v);
    });
  });
}
