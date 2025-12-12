import { makeJsEEClass } from '@/core/services/_utils';
import { balanceAccountType } from '@/hooks/useAccountsBalance';
import { ContactBookStore } from '@rabby-wallet/service-address';

export type PerfEventBusListeners = {
  EVENT_ROUTE_CHANGE: (ctx: {
    currentRouteName?: string;
    previousRouteName?: string;
  }) => void;

  APP_NAVIGATION_READY: (ctx: { readyRootName: string }) => void;

  ACCOUNTS_BALANCE_UPDATE: (ctx: {
    prevState: balanceAccountType[];
    nextState: balanceAccountType[];
  }) => void;

  CONTACTS_ALIASES_UPDATE: (ctx: {
    nextState: ContactBookStore['aliases'];
  }) => void;

  NAV_BACK_ON_HOME: () => void;

  TRIGGER_SINGLE_HOME_BALANCE: (force?: boolean) => void;

  'TMP_TRIGGER:FETCH_LENDING_DATA': () => void;
  'TMP_TRIGGER:SYNC_TOP10_HISTORY': (force?: boolean) => void;

  'TMP_TRIGGER:SINGLE_HOME_REFRESH': (ignoreLoading?: boolean) => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
