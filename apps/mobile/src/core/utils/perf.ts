import { makeJsEEClass } from '@/core/services/_utils';
import { balanceAccountType } from '@/hooks/useAccountsBalance';

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

  NAV_BACK_ON_HOME: () => void;

  'TMP_TRIGGER:FETCH_LENDING_DATA': () => void;
  'TMP_TRIGGER:SYNC_TOP10_HISTORY': (force?: boolean) => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
