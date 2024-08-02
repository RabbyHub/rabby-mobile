import { makeEEClass } from '@/core/apis/event';
import { GlobalSheetModalListeners } from './types';

export const globalSheetModalEvents =
  new (makeEEClass<GlobalSheetModalListeners>().EventEmitter)();

export const specificGlobalSheetModalEvents = new (makeEEClass<{
  cancelDappApproval: () => void;
}>().EventEmitter)();
