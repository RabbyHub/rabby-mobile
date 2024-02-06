import { CreateParams, EVENT_NAMES, MODAL_NAMES } from './types';
import { uniqueId } from 'lodash';
import { events } from './event';

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

export const snapToIndexGlobalBottomSheetModal = (
  key: string,
  index: number,
) => {
  events.emit(EVENT_NAMES.SNAP_TO_INDEX, key, index);
};
