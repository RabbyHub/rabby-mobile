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

  TMP_TRIGGER_FETCH_LENDING_DATA: () => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
