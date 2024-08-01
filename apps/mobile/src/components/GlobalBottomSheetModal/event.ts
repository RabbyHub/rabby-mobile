import { makeEEClass } from '@/core/apis/event';
import { GlobalSheetModalListeners } from './types';

const { EventEmitter } = makeEEClass<GlobalSheetModalListeners>();
export const globalSheetModalEvents = new EventEmitter();
