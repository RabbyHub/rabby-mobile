import { makeJsEEClass } from '@/core/services/_utils';

export type PerfEventBusListeners = {
  EVENT_ROUTE_CHANGE: (ctx: {
    currentRouteName?: string;
    previousRouteName?: string;
  }) => void;

  APP_NAVIGATION_READY: (ctx: { readyRootName: string }) => void;
};
type PerfListeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: PerfEE } =
  makeJsEEClass<PerfEventBusListeners /*  & PerfListeners */>();
export const perfEvents = new PerfEE();
