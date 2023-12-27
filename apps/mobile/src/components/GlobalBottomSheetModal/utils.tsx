import { CreateParams, EVENT_NAMES, MODAL_NAMES } from './types';
import EventEmitter from 'events';
import { uniqueId } from 'lodash';
import { Approval } from '../Approval';

export const events = new EventEmitter();

export const SNAP_POINTS: Record<MODAL_NAMES, (string | number)[]> = {
  [MODAL_NAMES.APPROVAL]: ['80%'],
};

export const MODAL_VIEWS: Record<MODAL_NAMES, React.ReactNode> = {
  [MODAL_NAMES.APPROVAL]: <Approval />,
};

export const createGlobalBottomSheetModal = (params: CreateParams) => {
  params.name = params.name ?? MODAL_NAMES.APPROVAL;
  const id = `${params.name}_${uniqueId()}`;
  events.emit(EVENT_NAMES.CREATE, id, params);
  return id;
};

export const removeGlobalBottomSheetModal = (key?: string | null) => {
  if (typeof key !== 'string') {
    return;
  }
  events.emit(EVENT_NAMES.REMOVE, key);
};

export const globalBottomSheetModalAddListener = (
  eventName: 'DISMISS',
  callback: (key: string) => void,
) => {
  events.on(eventName, callback);
};

export const presentGlobalBottomSheetModal = (key: string) => {
  events.emit(EVENT_NAMES.PRESENT, key);
};
