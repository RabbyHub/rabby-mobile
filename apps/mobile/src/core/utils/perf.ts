import { makeJsEEClass } from '@/core/utils/makeJsEEClass';
import type { Multi24hBalanceState } from '@/store/balance24h';
import type { ContactBookStore } from '@rabby-wallet/service-address';
import type { PreferenceStore } from '../services/preference';

export type PerfEventBusListeners = {
  EVENT_ROUTE_CHANGE: (ctx: {
    currentRouteName?: string;
    previousRouteName?: string;
  }) => void;

  APP_NAVIGATION_READY: (ctx: { readyRootName: string }) => void;

  CONTACTS_ALIASES_UPDATE: (ctx: {
    nextState: ContactBookStore['aliases'];
  }) => void;

  PREFERENCE_UPDATED: <T extends keyof PreferenceStore>(ctx: {
    key: T;
    value: PreferenceStore[T];
  }) => void;

  NAV_BACK_ON_HOME: () => void;

  HOME_WILL_BE_REFRESHED_MANUALLY: () => void;

  CHANGE_PREVENT_SCREENSHOT: (isPrevented: boolean) => void;

  SCENE_24H_BALANCE_UPDATED: (ctx: {
    scene: keyof Multi24hBalanceState['combinedData'];
    combinedData: Multi24hBalanceState['combinedData'][keyof Multi24hBalanceState['combinedData']];
  }) => void;

  WALLET_AUTH_UNLOCKED: (ctx: { isFirstTimeAfterLaunch: boolean }) => void;

  POST_UNLOCK_UI_READY: (ctx: { isFirstTimeAfterLaunch: boolean }) => void;

  /** @deprecated use WALLET_AUTH_UNLOCKED */
  USER_MANUALLY_UNLOCK: (ctx: { isFirstTimeAfterLaunch: boolean }) => void;

  /** @deprecated use POST_UNLOCK_UI_READY */
  USER_MANUALLY_UNLOCK_UI_READY: (ctx: {
    isFirstTimeAfterLaunch: boolean;
  }) => void;

  AUTO_TRIGGER_UNLOCK: () => void;

  GLOBAL_CLEAR_ALL_COVERED_COMPONENTS: () => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
perfEvents.setMaxListeners(1000);
