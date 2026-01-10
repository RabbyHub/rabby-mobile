import { makeJsEEClass } from '@/core/services/_utils';
import {
  AccountsBalanceState,
  BalanceAccountType,
} from '@/hooks/useAccountsBalance';
import {
  AddressBalanceUpdaterSource,
  BalanceState,
} from '@/hooks/useCurrentBalance';
import { Multi24hBalanceState } from '@/hooks/useScene24hBalance';
import { ContactBookStore } from '@rabby-wallet/service-address';
import { Account } from '../services/preference';

export type PerfEventBusListeners = {
  EVENT_ROUTE_CHANGE: (ctx: {
    currentRouteName?: string;
    previousRouteName?: string;
  }) => void;

  APP_NAVIGATION_READY: (ctx: { readyRootName: string }) => void;

  ACCOUNTS_BALANCE_UPDATE: (ctx: {
    prevState: AccountsBalanceState['balance'];
    nextState: AccountsBalanceState['balance'];
    setFromRemoteApi?: boolean;
  }) => void;

  CONTACTS_ALIASES_UPDATE: (ctx: {
    nextState: ContactBookStore['aliases'];
  }) => void;

  NAV_BACK_ON_HOME: () => void;

  HOME_WILL_BE_REFRESHED_MANUALLY: () => void;

  CHANGE_PREVENT_SCREENSHOT: (isPrevented: boolean) => void;

  SCENE_24H_BALANCE_UPDATED: (ctx: {
    scene: keyof Multi24hBalanceState['combinedData'];
    combinedData: Multi24hBalanceState['combinedData'][keyof Multi24hBalanceState['combinedData']];
  }) => void;

  'TMP_UPDATED:SINGLE_HOME_BALANCE': (data: {
    address: string;
    newBalance: BalanceState | null;
    prevBalance: BalanceState | null;
    force: boolean;
    fromScene: AddressBalanceUpdaterSource;
  }) => void;

  USER_MANUALLY_UNLOCK: () => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
