import { makeJsEEClass } from '@/core/services/_utils';
import { BalanceAccountType } from '@/hooks/useAccountsBalance';
import {
  AddressBalanceUpdaterSource,
  BalanceState,
} from '@/hooks/useCurrentBalance';
import { ContactBookStore } from '@rabby-wallet/service-address';

export type PerfEventBusListeners = {
  EVENT_ROUTE_CHANGE: (ctx: {
    currentRouteName?: string;
    previousRouteName?: string;
  }) => void;

  APP_NAVIGATION_READY: (ctx: { readyRootName: string }) => void;

  ACCOUNTS_MAYBE_CHANGED: (ctx: { confirmed?: boolean }) => void;

  ACCOUNTS_BALANCE_UPDATE: (ctx: {
    prevState: BalanceAccountType[];
    nextState: BalanceAccountType[];
  }) => void;

  CONTACTS_ALIASES_UPDATE: (ctx: {
    nextState: ContactBookStore['aliases'];
  }) => void;

  NAV_BACK_ON_HOME: () => void;

  'TMP_UPDATED:SINGLE_HOME_BALANCE': (data: {
    address: string;
    newBalance: BalanceState | null;
    prevBalance: BalanceState | null;
    force: boolean;
    fromScene: AddressBalanceUpdaterSource;
  }) => void;

  'TMP_TRIGGER:FETCH_LENDING_DATA': () => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
